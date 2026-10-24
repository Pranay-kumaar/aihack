import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import init_db, add_api_key, create_ticket, list_api_keys
from rag_engine import rag_engine, PDFS_DIR

def create_campus_pdf(filename: str, title: str, pages_data: list):
    filepath = os.path.join(PDFS_DIR, filename)
    doc = SimpleDocTemplate(filepath, pagesize=letter, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=15
    )
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#2563EB'),
        spaceBefore=12,
        spaceAfter=8
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=8
    )

    story = []

    for idx, (p_title, p_sections) in enumerate(pages_data):
        if idx > 0:
            story.append(PageBreak())
        
        story.append(Paragraph(f"<b>{title}</b>", title_style))
        story.append(Paragraph(f"<b>Page {idx + 1}: {p_title}</b>", section_style))
        story.append(Spacer(1, 10))

        for sec_heading, sec_content in p_sections:
            story.append(Paragraph(f"<b>{sec_heading}</b>", section_style))
            story.append(Paragraph(sec_content, body_style))
            story.append(Spacer(1, 6))

    doc.build(story)
    print(f"Generated PDF: {filepath}")
    return filepath

def seed():
    print("Initializing Database...")
    init_db()

    # 1. Generate Sample Campus PDFs
    handbook_pages = [
        ("General Academic Regulations & Code of Conduct", [
            ("1.1 Mandatory Attendance Regulation", 
             "A student is required to secure a minimum of 75% attendance in each registered theory, lab, and embedded course to be eligible to appear for the Final Assessment Test (FAT). Students with 74% to 65% attendance may apply for condonation on medical or university-approved official representation grounds, subject to approval from the Dean of Academics and payment of prescribed condonation fee. Attendance below 65% results in grade 'N' (Debarred due to lack of attendance), requiring the student to re-register for the course during the supplementary or summer semester."),
            ("1.2 Code of Student Conduct & Discipline", 
             "Every student must wear their official VIT Identity Card prominently while on university premises. Ragging in any form is strictly prohibited by law and university statute, carrying penalties up to immediate expulsion and police prosecution. Possession or consumption of alcohol, narcotics, cigarettes, or any prohibited substances inside campus or hostels results in severe disciplinary action including semester rustication.")
        ]),
        ("Grading System, GPA Calculation & Honours", [
            ("2.1 Ten-Point Grading System", 
             "VIT follows a 10-point relative grading scale for theory and laboratory courses: Grade 'S' (Outstanding, 10 points), Grade 'A' (Excellent, 9 points), Grade 'B' (Very Good, 8 points), Grade 'C' (Good, 7 points), Grade 'D' (Satisfactory, 6 points), Grade 'E' (Pass, 5 points), and Grade 'F' (Fail, 0 points). Grade 'N' indicates debarred due to shortage of attendance."),
            ("2.2 Dean's Honour List & Merit Scholarships", 
             "Students who secure a Semester Grade Point Average (SGPA) of 9.25 and above with no standing arrears and no disciplinary record are awarded the prestigious Dean's Honour List Certificate. The top 2% rank holders in each branch receive a 50% tuition scholarship under the University Merit Scheme.")
        ]),
        ("Fully Flexible Credit System (FFCS)", [
            ("3.1 FFCS Registration Timelines & Bidding", 
             "Registration for FFCS takes place online through the VTOP student portal 2 weeks prior to the commencement of each semester. Students may choose their preferred course slots, faculty members, and classroom venues. A minimum of 16 credits and a maximum of 27 credits can be registered per regular semester. Dropping a course without academic penalty is permitted within the first 5 working days of instruction.")
        ])
    ]

    hostel_pages = [
        ("Hostel Timings, Biometric Attendance & Curfew", [
            ("1.1 In-Campus & Hostel Curfew Hours", 
             "The campus main gate closes at 8:30 PM for all residential students. All Men's and Women's hostel blocks enforce mandatory biometric attendance check-in between 8:30 PM and 9:00 PM daily. Students failing to register biometric attendance by 9:00 PM without an authorized night slip will have an automated SMS alert dispatched to their registered parents/guardians and will face disciplinary inquiry by the Chief Warden."),
            ("1.2 Night Slip & Leave Application Procedure", 
             "Any student intending to stay out of hostel for weekends, vacations, or official events must submit an e-Leave / Night Slip application through the VTOP mobile app at least 24 hours in advance. Parent OTP approval is mandatory for leave approval. Departure from the hostel is permitted between 6:00 AM and 6:00 PM.")
        ]),
        ("Mess Catering Services & Hostel Amenities", [
            ("2.1 Mess Types & Monthly Mess Change Policy", 
             "Hostel dining facilities offer Vegetarian, Non-Vegetarian, Special, and Food Court catering services. Students may switch their designated mess type between the 20th and 25th of every month through the VTOP hostel portal, effective from the 1st of the succeeding month. Outside food delivery personnel are restricted to designated security gate delivery hubs.")
        ])
    ]

    health_pages = [
        ("Health Centre Facilities & Emergency Hotlines", [
            ("1.1 24x7 University Health Centre", 
             "The University Health Centre is located directly behind the Silver Jubilee Tower (SJT). It provides 24-hour outpatient care, general physicians, pharmacy dispensary, and observation wards. Emergency direct line: +91-416-220-2100 or extension 2100. Emergency ambulance service is stationed on campus 24x7 and can be dispatched immediately by dialing 2100."),
            ("1.2 Student Psychological Counselling - SMILE Center", 
             "The SMILE Counselling and Wellbeing Centre offers confidential, free psychological support and mental health counseling. Professional counselors are available Monday to Saturday, 9:00 AM to 6:30 PM in the Technology Tower (TT) 1st floor. Appointments can be scheduled online via smile@vit.ac.in or emergency helpline +91-416-220-2115.")
        ])
    ]

    exam_pages = [
        ("Continuous Assessment & Final Examination Scheme", [
            ("1.1 Evaluation Weightage & Examination Format", 
             "Evaluation for each theory course comprises Continuous Assessment Tests (CAT-1: 15%, CAT-2: 15%), Digital Assignments / Quizzes (30%), and the comprehensive Final Assessment Test (FAT: 40%). A student must secure a minimum of 40% aggregate marks in the continuous components and FAT combined to qualify for passing the course."),
            ("1.2 Grade Improvement & Supplementary Examinations", 
             "Supplementary examinations are conducted at the end of each semester for students with 'F' or 'N' grades. Students holding passing grades (D or E) who wish to enhance their CGPA may opt for Grade Improvement during the subsequent summer term.")
        ])
    ]

    docs_to_create = [
        ("VIT_Student_Handbook_2026.pdf", "VIT Student Handbook & Regulations 2026", handbook_pages, "Academic"),
        ("Hostel_Rules_and_Mess_Regulations.pdf", "Hostel Living Guidelines & Mess Norms", hostel_pages, "Hostel & Residential"),
        ("Campus_Health_and_Emergency_Services.pdf", "Campus Emergency & Health Services Manual", health_pages, "Health & Safety"),
        ("Academics_and_Grading_System.pdf", "Continuous Assessment & Examination Policies", exam_pages, "Examinations")
    ]

    for fname, title, pages, category in docs_to_create:
        fpath = create_campus_pdf(fname, title, pages)
        print(f"Indexing PDF into RAG Vector Store: {title}...")
        try:
            res = rag_engine.index_pdf(fpath, fname, category=category)
            print(f"  Indexed: {res['chunks']} chunks across {res['pages']} pages.")
        except Exception as e:
            print(f"  Indexing note: {e}")

    # 2. Seed default Gemini API Keys for Round-Robin Failover showcase
    existing_keys = list_api_keys()
    if not existing_keys:
        env_gemini = os.environ.get("GEMINI_API_KEY", "")
        # Add primary key
        if env_gemini:
            add_api_key(env_gemini, "Primary Production Key (Env)")
        else:
            add_api_key("AIzaSyVITPrimaryProductionAlphaKey9921", "Primary Production Key")
        
        add_api_key("AIzaSyVITSecondaryFailoverBetaKey7732", "Secondary Failover Key")
        add_api_key("AIzaSyVITTertiaryBurstGammaKey4410", "Tertiary Emergency Backup Key")
        print("Seeded 3 Round-Robin Gemini API Keys for failover testing.")

    # 3. Seed sample Support Tickets
    sample_tickets = [
        {
            "student_name": "Aarav Sharma",
            "reg_number": "22BCE1042",
            "email": "aarav.sharma2022@vitstudent.ac.in",
            "category": "Hostel",
            "subject": "Request for Mess Type Change Exception",
            "query_text": "I missed the monthly deadline on VTOP due to hackathon travel. Requesting permission to switch to Food Court mess.",
            "priority": "Medium"
        },
        {
            "student_name": "Sneha Patel",
            "reg_number": "23BCI0189",
            "email": "sneha.patel2023@vitstudent.ac.in",
            "category": "Academics",
            "subject": "Medical Condonation for CAT-2 Absence",
            "query_text": "Hospitalized due to viral infection during CAT-2 week. Attached medical certificate from VIT Health Centre.",
            "priority": "High"
        }
    ]

    for t in sample_tickets:
        num = create_ticket(t)
        print(f"Seeded sample ticket: {num}")

    print("Seed complete! All sample PDFs, vector embeddings, API keys, and tickets are ready.")

if __name__ == "__main__":
    seed()
