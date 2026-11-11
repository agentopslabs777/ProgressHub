import io
import csv
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.session import get_db
from backend.app.models.models import (
    Enrollment, Program, LearningTrack, LearningDay, DayProgress,
    ChecklistTemplateItem, ChecklistCompletion, DailyTask, TaskSubmission,
    GoogleDriveSubmission, User
)
from backend.app.permissions.permissions import get_current_user, require_employee, require_admin
from backend.app.services.learning_engine import calculate_enrollment_progress, get_track_days_status

router = APIRouter(prefix="/reviews", tags=["Student Reviews & Performance"])

@router.get("/overview", response_model=dict)
def get_performance_overview(
    program_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")

    enr_query = db.query(Enrollment)
    if current_user.role == "employee":
        enr_query = enr_query.filter(Enrollment.employee_id == current_user.id)
    if program_id:
        enr_query = enr_query.filter(Enrollment.program_id == program_id)

    enrollments = enr_query.all()
    total_students = len(enrollments)
    active_students = sum(1 for e in enrollments if e.status == "active")

    progresses = [calculate_enrollment_progress(db, e) for e in enrollments]
    avg_progress = round(sum(progresses) / len(progresses), 1) if progresses else 0.0

    # Pending task submissions
    task_sub_query = db.query(TaskSubmission).filter(TaskSubmission.status.in_(["submitted", "under_review"]))
    drive_sub_query = db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.status.in_(["submitted", "under_review"]))

    if current_user.role == "employee":
        emp_eids = [e.id for e in enrollments]
        task_sub_query = task_sub_query.filter(TaskSubmission.enrollment_id.in_(emp_eids))
        drive_sub_query = drive_sub_query.filter(GoogleDriveSubmission.enrollment_id.in_(emp_eids))

    pending_tasks = task_sub_query.count()
    pending_drive = drive_sub_query.count()

    return {
        "total_students": total_students,
        "active_students": active_students,
        "avg_completion_rate": avg_progress,
        "pending_reviews_count": pending_tasks + pending_drive,
        "pending_task_submissions": pending_tasks,
        "pending_drive_submissions": pending_drive
    }

@router.get("/spreadsheet", response_model=dict)
def get_performance_spreadsheet(
    program_id: Optional[str] = None,
    student_id: Optional[str] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")

    # If program not specified, pick the first published or available program
    if not program_id:
        first_prog = db.query(Program).order_by(Program.created_at.desc()).first()
        if not first_prog:
            return {"columns": [], "rows": [], "program_name": "No Programs", "enrolled_students": []}
        target_program_id = first_prog.id
        program_name = first_prog.name
    else:
        prog = db.query(Program).filter(Program.id == program_id).first()
        if not prog:
            raise HTTPException(status_code=404, detail="Program not found")
        target_program_id = prog.id
        program_name = prog.name

    # Gather list of enrolled students for this program (for student picker / autocomplete)
    base_students_query = db.query(Enrollment).filter(Enrollment.program_id == target_program_id)
    if current_user.role == "employee":
        base_students_query = base_students_query.filter(Enrollment.employee_id == current_user.id)
    all_enrolled_records = base_students_query.all()

    enrolled_students = []
    seen_ids = set()
    for e in all_enrolled_records:
        if e.student and e.student.id not in seen_ids:
            seen_ids.add(e.student.id)
            prog_val = calculate_enrollment_progress(db, e)
            enrolled_students.append({
                "id": e.student.id,
                "name": e.student.full_name,
                "email": e.student.email,
                "enrollment_id": e.id,
                "status": e.status,
                "progress": prog_val,
                "teacher_name": e.employee.full_name if e.employee else "Unassigned"
            })
    # Sort students alphabetically by name
    enrolled_students.sort(key=lambda s: s["name"].lower())

    # Discover all days across active tracks of this program
    tracks = db.query(LearningTrack).filter(
        LearningTrack.program_id == target_program_id,
        LearningTrack.active == True
    ).order_by(LearningTrack.position.asc()).all()

    all_days = []
    for t in tracks:
        days = db.query(LearningDay).filter(
            LearningDay.track_id == t.id
        ).order_by(LearningDay.day_number.asc()).all()
        for d in days:
            all_days.append({
                "id": d.id,
                "track_name": t.name,
                "day_number": d.day_number,
                "title": d.title
            })

    # Define base columns
    columns = [
        {"key": "student_name", "label": "Student Name", "fixed": True},
        {"key": "student_email", "label": "Email", "fixed": True},
        {"key": "teacher_name", "label": "Assigned Instructor"},
        {"key": "enrollment_status", "label": "Enrollment Status"},
        {"key": "overall_progress", "label": "Overall Progress"}
    ]

    # Dynamically append columns for each day
    for d in all_days:
        day_key = f"day_{d['day_number']}"
        columns.append({"key": f"{day_key}_status", "label": f"Day {d['day_number']} Status", "day_id": d["id"]})
        columns.append({"key": f"{day_key}_checklist", "label": f"Day {d['day_number']} Checklist", "day_id": d["id"]})
        columns.append({"key": f"{day_key}_task", "label": f"Day {d['day_number']} Assignment", "day_id": d["id"]})
        columns.append({"key": f"{day_key}_drive", "label": f"Day {d['day_number']} Student Link", "day_id": d["id"]})
        columns.append({"key": f"{day_key}_review", "label": f"Day {d['day_number']} Faculty Review", "day_id": d["id"]})

    # Query enrollments
    enr_query = db.query(Enrollment).filter(Enrollment.program_id == target_program_id)
    if current_user.role == "employee":
        enr_query = enr_query.filter(Enrollment.employee_id == current_user.id)
    if status_filter:
        enr_query = enr_query.filter(Enrollment.status == status_filter)
    if student_id:
        enr_query = enr_query.filter(Enrollment.student_id == student_id)

    enrollments = enr_query.all()
    rows = []

    for enr in enrollments:
        stu = enr.student
        if not stu:
            continue

        if search:
            search_lower = search.lower()
            if search_lower not in stu.full_name.lower() and search_lower not in stu.email.lower():
                continue

        progress_pct = calculate_enrollment_progress(db, enr)

        row: Dict[str, Any] = {
            "enrollment_id": enr.id,
            "student_id": stu.id,
            "student_name": stu.full_name,
            "student_email": stu.email,
            "teacher_name": enr.employee.full_name if enr.employee else "Unassigned",
            "enrollment_status": enr.status,
            "overall_progress": f"{progress_pct}%"
        }

        # Query all DayProgress for this enrollment
        dp_records = {dp.day_id: dp for dp in db.query(DayProgress).filter(DayProgress.enrollment_id == enr.id).all()}
        # Query all Checklist completions for this enrollment
        cl_completions = {cc.item_id for cc in db.query(ChecklistCompletion).filter(ChecklistCompletion.enrollment_id == enr.id, ChecklistCompletion.completed == True).all()}
        # Query task submissions
        task_subs = {ts.task_id: ts for ts in db.query(TaskSubmission).filter(TaskSubmission.enrollment_id == enr.id).all()}
        # Query drive submissions
        drive_subs = {ds.day_id: ds for ds in db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.enrollment_id == enr.id, GoogleDriveSubmission.is_latest == True).all()}

        for d in all_days:
            day_id = d["id"]
            day_num = d["day_number"]
            day_key = f"day_{day_num}"

            dp = dp_records.get(day_id)
            is_comp = dp.is_completed if dp else False

            # Checklist stats
            cl_items = db.query(ChecklistTemplateItem).filter(ChecklistTemplateItem.day_id == day_id, ChecklistTemplateItem.active == True).all()
            if cl_items:
                done_count = sum(1 for it in cl_items if it.id in cl_completions)
                checklist_val = f"{done_count}/{len(cl_items)}"
            else:
                checklist_val = "N/A"

            # Task status
            day_tasks = db.query(DailyTask).filter(DailyTask.day_id == day_id).all()
            if day_tasks:
                first_task = day_tasks[0]
                ts = task_subs.get(first_task.id)
                task_val = ts.status if ts else "Not Submitted"
            else:
                task_val = "N/A"

            # Google Drive status
            ds = drive_subs.get(day_id)
            if ds:
                drive_val = f"{ds.status} ({ds.google_drive_url})"
                review_val = f"Rating: {ds.rating or 'N/A'} - {ds.review_comments or 'No remarks'}"
            else:
                drive_val = "Not Submitted"
                review_val = "Pending Review" if not is_comp else "Completed"

            status_val = "Completed" if is_comp else ("Pending Review" if (ds and ds.status in ("submitted", "under_review")) else "In Progress")

            row[f"{day_key}_status"] = status_val
            row[f"{day_key}_checklist"] = checklist_val
            row[f"{day_key}_task"] = task_val
            row[f"{day_key}_drive"] = drive_val
            row[f"{day_key}_review"] = review_val

        rows.append(row)

    # Compute dedicated Day-by-Day student rows for the selected student
    student_day_rows = []
    if student_id and enrollments:
        target_enr = enrollments[0]
        dp_records = {dp.day_id: dp for dp in db.query(DayProgress).filter(DayProgress.enrollment_id == target_enr.id).all()}
        drive_subs = {ds.day_id: ds for ds in db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.enrollment_id == target_enr.id, GoogleDriveSubmission.is_latest == True).all()}

        for d in all_days:
            day_id = d["id"]
            day_num = d["day_number"]
            title = d["title"]
            dp = dp_records.get(day_id)
            ds = drive_subs.get(day_id)

            is_comp = dp.is_completed if dp else False

            if is_comp:
                st = "Completed"
            elif ds and ds.status in ("submitted", "under_review"):
                st = "Under Review"
            else:
                st = "In Progress"

            if dp and dp.quiz_score is not None:
                q_marks = f"{dp.quiz_score} / 100"
            elif dp and dp.quiz_completed:
                q_marks = "Completed (Score Pending)"
            else:
                q_marks = "Not Taken"

            if ds and ds.google_drive_url:
                asg_link = ds.google_drive_url
                asg_sub = f"Submitted (Attempt #{ds.attempt_number or 1})"
            else:
                asg_link = ""
                asg_sub = "Not Submitted"

            if ds and ds.reviewed_at:
                verdict = ds.status.upper() if ds.status else "REVIEWED"
                rev_text = f"{verdict} (Score: {ds.rating or 0}/100"
                if ds.additional_reward_points:
                    rev_text += f", +{ds.additional_reward_points} pts"
                rev_text += ")"
                if ds.review_comments:
                    rev_text += f" - {ds.review_comments}"
            elif ds:
                rev_text = "Pending Faculty Review"
            else:
                rev_text = "Pending Evaluation"

            student_day_rows.append({
                "day_id": day_id,
                "day_number": day_num,
                "submodule_name": f"Day {day_num}: {title}",
                "track_name": d["track_name"],
                "status": st,
                "quiz_marks": q_marks,
                "quiz_score": dp.quiz_score if dp else None,
                "assignment_link": asg_link,
                "assignment_submitted": asg_sub,
                "attempt_number": ds.attempt_number if ds else 1,
                "faculty_review": rev_text,
                "review_status": ds.status if ds else None,
                "rating": ds.rating if ds else None,
                "additional_points": ds.additional_reward_points if ds else 0,
                "review_comments": ds.review_comments if ds else None
            })

    return {
        "program_id": target_program_id,
        "program_name": program_name,
        "columns": columns,
        "rows": rows,
        "total_rows": len(rows),
        "enrolled_students": enrolled_students,
        "student_day_rows": student_day_rows
    }

@router.get("/spreadsheet/export")
def export_performance_csv(
    program_id: Optional[str] = None,
    student_id: Optional[str] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")

    data = get_performance_spreadsheet(
        program_id=program_id,
        student_id=student_id,
        search=search,
        status_filter=status_filter,
        current_user=current_user,
        db=db
    )
    columns = data["columns"]
    rows = data["rows"]
    student_day_rows = data.get("student_day_rows", [])
    program_name = data["program_name"].replace(" ", "_")

    output = io.StringIO()
    writer = csv.writer(output)

    # If exporting for a specific student, write the dedicated 5-column Day-by-Day worksheet
    if student_id and student_day_rows:
        headers = ["Submodule Name", "Status", "Quiz Marks", "Assignment Link", "Faculty Review"]
        writer.writerow(headers)
        for r in student_day_rows:
            writer.writerow([
                r.get("submodule_name", ""),
                r.get("status", ""),
                r.get("quiz_marks", ""),
                r.get("assignment_link", "") or r.get("assignment_submitted", ""),
                r.get("faculty_review", "")
            ])
    else:
        # Write general multi-student CSV
        headers = [col["label"] for col in columns]
        writer.writerow(headers)
        for r in rows:
            row_values = [str(r.get(col["key"], "")) for col in columns]
            writer.writerow(row_values)

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=performance_report_{program_name}.csv"
        }
    )
