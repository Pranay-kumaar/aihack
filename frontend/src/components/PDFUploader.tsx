"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface PDFUploaderProps {
  onUploadSuccess: () => void;
}

export default function PDFUploader({ onUploadSuccess }: PDFUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Academic");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
        setErrorMessage("Only PDF files are supported.");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setErrorMessage(null);
      setUploadSuccess(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Please select a PDF file to upload.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    try {
      const res = await fetch("http://localhost:8000/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to upload and index PDF document.");
      }

      const data = await res.json();
      setUploadSuccess(`Successfully ingested & indexed "${file.name}" (${data.data?.chunks || 0} chunks).`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploadSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Upload PDF to Knowledge Base
        </h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Dynamic recursive chunking & vector embedding generation without server restart.
        </p>
      </div>

      {uploadSuccess && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
            file
              ? "border-neutral-900 bg-neutral-50 dark:border-neutral-400 dark:bg-neutral-800/40"
              : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-700"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {file ? (
            <div className="flex flex-col items-center justify-center space-y-1">
              <FileText className="h-8 w-8 text-neutral-800 dark:text-neutral-200" />
              <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {file.name}
              </p>
              <p className="text-[11px] text-neutral-400">
                {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for ingestion
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-1">
              <Upload className="h-7 w-7 text-neutral-400" />
              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Click or drag PDF document here
              </p>
              <p className="text-[11px] text-neutral-400">
                Supports syllabi, circulars, handbooks, regulations (PDF up to 50MB)
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300"
            >
              <option value="Academic">Academic & Syllabi</option>
              <option value="Hostel & Residential">Hostel & Residential</option>
              <option value="Examinations">Examinations & FAT</option>
              <option value="Health & Safety">Health & Safety</option>
              <option value="Events & Clubs">Events & Clubs</option>
              <option value="General">General Campus Circular</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={!file || isUploading}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Chunking & Indexing...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Ingest PDF Document
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
