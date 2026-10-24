import time
import os
import threading
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Callable
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted, GoogleAPICallError, PermissionDenied, Unauthenticated

from database import (
    list_api_keys,
    mark_key_rate_limited,
    reset_key_rate_limit,
    record_key_success,
    log_audit,
    get_setting,
    set_setting
)

class AllKeysExhaustedException(Exception):
    """Raised when all active Gemini API keys are exhausted or rate-limited."""
    pass

class NoActiveKeysException(Exception):
    """Raised when no Gemini API keys are configured or enabled."""
    pass

class GeminiKeyManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(GeminiKeyManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.lock = threading.Lock()
        # Restore pointer from setting or default to 0
        try:
            self.pointer = int(get_setting("active_key_index", "0"))
        except Exception:
            self.pointer = 0
        self.cooldown_seconds = 90
        self._initialized = True

    def get_all_keys(self) -> List[Dict[str, Any]]:
        return list_api_keys()

    def get_eligible_keys(self) -> List[Dict[str, Any]]:
        """
        Returns all enabled keys. Automatically clears cooldowns for keys
        whose rate_limit_reset_at has elapsed.
        """
        all_keys = list_api_keys()
        now = datetime.now()
        eligible = []

        for key in all_keys:
            if not key["is_active"]:
                continue
            
            # Check rate limit cooldown expiration
            if key["is_rate_limited"]:
                reset_at_str = key.get("rate_limit_reset_at")
                if reset_at_str:
                    try:
                        reset_at = datetime.fromisoformat(reset_at_str)
                        if now >= reset_at:
                            reset_key_rate_limit(key["id"])
                            key["is_rate_limited"] = 0
                            log_audit("KEY_RECOVERED", f"API Key '{key['label']}' cooldown period elapsed. Restored to active pool.")
                    except Exception:
                        pass
            
            if not key["is_rate_limited"]:
                eligible.append(key)

        return eligible

    def get_current_active_key(self) -> Optional[Dict[str, Any]]:
        """
        Returns the current active key according to the round-robin pointer.
        """
        with self.lock:
            eligible = self.get_eligible_keys()
            if not eligible:
                return None
            idx = self.pointer % len(eligible)
            return eligible[idx]

    def advance_pointer(self, reason: str = "Round-Robin rotation"):
        """
        Advances the round-robin pointer to the next active key.
        """
        with self.lock:
            eligible = self.get_eligible_keys()
            if not eligible:
                return
            old_idx = self.pointer % len(eligible)
            self.pointer = (self.pointer + 1) % len(eligible)
            set_setting("active_key_index", str(self.pointer))
            new_key = eligible[self.pointer % len(eligible)]
            log_audit("KEY_ROTATION", f"Round-robin pointer advanced from Key #{eligible[old_idx]['id']} to Key #{new_key['id']} ({new_key['label']}). Reason: {reason}")

    def trigger_failover(self, failed_key_id: int, error_message: str):
        """
        Marks the key as exhausted/rate-limited, advances pointer, and logs failover event.
        """
        with self.lock:
            reset_time = (datetime.now() + timedelta(seconds=self.cooldown_seconds)).isoformat()
            mark_key_rate_limited(failed_key_id, reset_time)
            
            log_audit(
                "FAILOVER", 
                f"Rate limit / Quota exceeded on Key #{failed_key_id}. Immediate failover initiated.",
                {"failed_key_id": failed_key_id, "error": error_message, "cooldown_seconds": self.cooldown_seconds}
            )
            
            # Recompute eligible keys and shift pointer
            eligible = self.get_eligible_keys()
            if eligible:
                self.pointer = (self.pointer + 1) % len(eligible)
                set_setting("active_key_index", str(self.pointer))
                next_key = eligible[self.pointer % len(eligible)]
                log_audit("KEY_SHIFT", f"Failover successful: Shifted active traffic to Key #{next_key['id']} ({next_key['label']}).")
            else:
                log_audit("ALL_KEYS_EXHAUSTED", "CRITICAL: All configured Gemini API keys are exhausted or rate-limited!")

    def execute_with_failover(self, api_func: Callable[[str], Any]) -> Dict[str, Any]:
        """
        Executes a Gemini API operation using the active round-robin key.
        If a 429/ResourceExhausted or auth error is encountered, catches it, marks the key
        as exhausted, rotates pointer, and seamlessly retries with the next key.
        
        `api_func` must be a callable that takes `api_key: str` as its sole argument.
        Returns: {"result": Any, "key_used": str, "key_label": str}
        """
        all_keys = list_api_keys()
        if not all_keys:
            raise NoActiveKeysException("No Gemini API keys have been configured in the system. Please add one via Admin Dashboard.")

        eligible_keys = self.get_eligible_keys()
        if not eligible_keys:
            log_audit("REQUEST_DROPPED", "Request rejected: All Gemini API keys are currently rate-limited or disabled.")
            raise AllKeysExhaustedException("All Gemini API keys are currently exhausted or experiencing rate limits. Student Support Office fallback active.")

        max_attempts = len(eligible_keys)
        attempts = 0

        while attempts < max_attempts:
            eligible_keys = self.get_eligible_keys()
            if not eligible_keys:
                raise AllKeysExhaustedException("All Gemini API keys are exhausted.")

            current_key = self.get_current_active_key()
            if not current_key:
                raise AllKeysExhaustedException("No eligible API key found.")

            key_val = current_key["api_key"]
            key_id = current_key["id"]
            key_label = current_key["label"]

            try:
                # Configure Gemini client with the chosen key
                genai.configure(api_key=key_val)
                result = api_func(key_val)
                
                # Record success and advance pointer smoothly for round-robin distribution
                record_key_success(key_id)
                self.advance_pointer(reason="Seamless round-robin load distribution")
                
                return {
                    "result": result,
                    "key_id": key_id,
                    "key_label": key_label,
                    "masked_key": current_key.get("masked_key", "***")
                }

            except (ResourceExhausted, GoogleAPICallError, PermissionDenied, Unauthenticated, Exception) as exc:
                err_str = str(exc)
                is_rate_limit = (
                    isinstance(exc, ResourceExhausted) or 
                    "429" in err_str or 
                    "quota" in err_str.lower() or 
                    "resource_exhausted" in err_str.lower()
                )
                is_auth_error = (
                    isinstance(exc, (PermissionDenied, Unauthenticated)) or 
                    "401" in err_str or 
                    "403" in err_str or 
                    "API_KEY_INVALID" in err_str
                )

                if is_rate_limit or is_auth_error:
                    self.trigger_failover(key_id, err_str)
                    attempts += 1
                    continue
                else:
                    # Non-quota unexpected error
                    log_audit("API_ERROR", f"Error during Gemini call with key #{key_id}: {err_str[:200]}")
                    raise exc

        raise AllKeysExhaustedException("All available Gemini API keys failed after multiple round-robin retry attempts.")

    def simulate_manual_failover(self) -> Dict[str, Any]:
        """
        Explicit admin action: Deliberately simulates a 429 quota exhaustion on
        the currently active key to prove and verify the failover mechanism.
        """
        current_key = self.get_current_active_key()
        if not current_key:
            return {"status": "error", "message": "No active key available to simulate failover on."}
        
        self.trigger_failover(
            current_key["id"], 
            "SIMULATED_429: Manual admin simulated quota exhaustion test"
        )
        
        new_active = self.get_current_active_key()
        return {
            "status": "success",
            "message": f"Successfully simulated 429 failover from Key #{current_key['id']} ({current_key['label']})",
            "previous_key": current_key["label"],
            "new_active_key": new_active["label"] if new_active else "None (All Exhausted)",
            "cooldown_seconds": self.cooldown_seconds
        }

key_manager = GeminiKeyManager()
