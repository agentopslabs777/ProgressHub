import pytest
import secrets
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.models import (
    User, Program, LearningTrack, LearningDay, Enrollment,
    DayProgress, ChecklistTemplateItem, DailyTask, GoogleDriveSubmission,
    ReferralCampaign, ReferralRecord
)

client = TestClient(app)

def test_health_check():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_login_success_and_failure():
    # Valid login
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@training.local",
        "password": "AdminPass123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"

    # Invalid password
    bad_res = client.post("/api/v1/auth/login", json={
        "email": "admin@training.local",
        "password": "WrongPassword!"
    })
    assert bad_res.status_code == 401

def test_multi_resource_curriculum_crud():
    # 1. Admin login
    admin_res = client.post("/api/v1/auth/login", json={
        "email": "admin@training.local",
        "password": "AdminPass123!"
    })
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create program & track
    p_code = f"TEST-{secrets.token_hex(3).upper()}"
    prog_res = client.post("/api/v1/programs", json={
        "name": "Cloud Native Architecture",
        "code": p_code,
        "description": "Enterprise cloud program",
        "status": "published"
    }, headers=admin_headers)
    assert prog_res.status_code == 200
    prog_id = prog_res.json()["id"]

    track_res = client.post(f"/api/v1/programs/{prog_id}/tracks", json={
        "name": "Microservices Track",
        "description": "Building microservices",
        "position": 1
    }, headers=admin_headers)
    track_id = track_res.json()["id"]

    # 3. Add Day with Telugu & English Summaries
    day_res = client.post(f"/api/v1/tracks/{track_id}/days", json={
        "day_number": 1,
        "title": "Service Discovery & Registries",
        "summary_main": "Service registries enable dynamic lookup of service instances.",
        "summary_english": "English overview: Eureka, Consul, and DNS-based service discovery.",
        "summary_telugu": "తెలుగు సారాంశం: మైక్రోసర్వీసెస్ మధ్య సమాచార మార్పిడి మరియు సర్వీస్ డిస్కవరీ.",
        "unlock_delay_hours": 24.0,
        "unlock_mode": "both",
        "require_google_drive_submission": True,
        "published": True
    }, headers=admin_headers)
    assert day_res.status_code == 200
    day_id = day_res.json()["id"]

    # 4. Add Resource and Flashcard
    res_add = client.post(f"/api/v1/days/{day_id}/resources", json={
        "title": "Spring Cloud Netflix Guide",
        "resource_type": "link",
        "url": "https://spring.io/projects/spring-cloud-netflix"
    }, headers=admin_headers)
    assert res_add.status_code == 200
    assert res_add.json()["title"] == "Spring Cloud Netflix Guide"

    fc_add = client.post(f"/api/v1/days/{day_id}/flashcards", json={
        "front_text": "What is client-side load balancing?",
        "back_text": "When the client chooses which backend instance to send requests to."
    }, headers=admin_headers)
    assert fc_add.status_code == 200
    assert "load balancing" in fc_add.json()["front_text"]

    # 5. Fetch Day details
    day_details = client.get(f"/api/v1/days/{day_id}", headers=admin_headers).json()
    assert day_details["summary_telugu"] is not None
    assert len(day_details["resources"]) == 1
    assert len(day_details["flashcards"]) == 1

def test_24_hour_unlock_and_manual_override():
    admin_res = client.post("/api/v1/auth/login", json={
        "email": "admin@training.local",
        "password": "AdminPass123!"
    })
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    stu_res = client.post("/api/v1/auth/login", json={
        "email": "student@training.local",
        "password": "StudentPass123!"
    })
    stu_headers = {"Authorization": f"Bearer {stu_res.json()['access_token']}"}
    stu_id = stu_res.json()["user"]["id"]

    # Create program with 2 days
    p_code = f"TIMER-{secrets.token_hex(3).upper()}"
    p_id = client.post("/api/v1/programs", json={
        "name": "DevOps Intensive",
        "code": p_code,
        "status": "published"
    }, headers=admin_headers).json()["id"]

    t_id = client.post(f"/api/v1/programs/{p_id}/tracks", json={
        "name": "CI/CD Pipeline",
        "position": 1
    }, headers=admin_headers).json()["id"]

    d1_id = client.post(f"/api/v1/tracks/{t_id}/days", json={
        "day_number": 1,
        "title": "GitLab CI Basics",
        "published": True
    }, headers=admin_headers).json()["id"]

    d2_id = client.post(f"/api/v1/tracks/{t_id}/days", json={
        "day_number": 2,
        "title": "Kubernetes Deployment",
        "unlock_delay_hours": 24.0,
        "unlock_mode": "both",
        "published": True
    }, headers=admin_headers).json()["id"]

    chk_id = client.post(f"/api/v1/days/{d1_id}/checklist", json={
        "title": "Create .gitlab-ci.yml file",
        "is_required": True
    }, headers=admin_headers).json()["id"]

    # Enroll student
    enr_res = client.post("/api/v1/enrollments", json={
        "student_id": stu_id,
        "program_id": p_id
    }, headers=admin_headers).json()
    enrollment_id = enr_res["id"]

    # Student completes Day 1
    client.post(f"/api/v1/checklist-completions?item_id={chk_id}&completed=true", headers=stu_headers)

    # Day 2 has a 24-hour waiting rule, so it MUST be locked with remaining_seconds > 0!
    prog = client.get(f"/api/v1/student/programs/{p_id}/progress", headers=stu_headers).json()
    day2_status = prog[0]["days"][1]
    assert day2_status["status"] == "locked"
    assert day2_status["remaining_seconds"] > 0

    # Direct access to Day 2 is blocked with 403 Forbidden!
    blocked = client.get(f"/api/v1/student/days/{d2_id}", headers=stu_headers)
    assert blocked.status_code == 403
    assert "locked" in blocked.json()["detail"].lower()

    # Manual Unlock Override by Instructor
    unlock_res = client.post(
        f"/api/v1/enrollments/{enrollment_id}/days/{d2_id}/unlock",
        json={"reason": "Fast learner early unlock approval"},
        headers=admin_headers
    )
    assert unlock_res.status_code == 200
    assert unlock_res.json()["is_manually_unlocked"] == True

    # Now Day 2 is immediately accessible to the student!
    prog_after_unlock = client.get(f"/api/v1/student/programs/{p_id}/progress", headers=stu_headers).json()
    day2_unlocked = prog_after_unlock[0]["days"][1]
    assert day2_unlocked["status"] == "available"
    assert day2_unlocked["is_manually_unlocked"] == True

    allowed = client.get(f"/api/v1/student/days/{d2_id}", headers=stu_headers)
    assert allowed.status_code == 200
    assert allowed.json()["title"] == "Kubernetes Deployment"

def test_google_drive_submission_and_review_workflow():
    admin_res = client.post("/api/v1/auth/login", json={
        "email": "admin@training.local",
        "password": "AdminPass123!"
    })
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    stu_res = client.post("/api/v1/auth/login", json={
        "email": "student@training.local",
        "password": "StudentPass123!"
    })
    stu_headers = {"Authorization": f"Bearer {stu_res.json()['access_token']}"}
    stu_id = stu_res.json()["user"]["id"]

    # Create program and day requiring drive link
    p_code = f"DRIVE-{secrets.token_hex(3).upper()}"
    p_id = client.post("/api/v1/programs", json={"name": "Data Analytics", "code": p_code, "status": "published"}, headers=admin_headers).json()["id"]
    t_id = client.post(f"/api/v1/programs/{p_id}/tracks", json={"name": "PowerBI Track", "position": 1}, headers=admin_headers).json()["id"]
    d_id = client.post(f"/api/v1/tracks/{t_id}/days", json={
        "day_number": 1,
        "title": "Interactive Dashboard Creation",
        "require_google_drive_submission": True,
        "require_approval": True,
        "published": True
    }, headers=admin_headers).json()["id"]

    client.post("/api/v1/enrollments", json={"student_id": stu_id, "program_id": p_id}, headers=admin_headers)

    # 1. Invalid link rejected
    bad_sub = client.post("/api/v1/submissions/google-drive", json={
        "day_id": d_id,
        "google_drive_url": "https://invalid-storage.com/file"
    }, headers=stu_headers)
    assert bad_sub.status_code == 400
    assert "Invalid Google Drive link" in bad_sub.json()["detail"]

    # 2. Valid Google Drive URL accepted
    good_sub = client.post("/api/v1/submissions/google-drive", json={
        "day_id": d_id,
        "google_drive_url": "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OGvE2upms/view",
        "notes": "PowerBI dashboard portfolio submission"
    }, headers=stu_headers)
    assert good_sub.status_code == 200
    sub_id = good_sub.json()["id"]
    assert good_sub.json()["attempt_number"] == 1

    # 3. Instructor reviews & evaluates
    review_res = client.post(f"/api/v1/submissions/google-drive/{sub_id}/review", json={
        "status": "approved",
        "rating": 95,
        "review_comments": "Exceptional visualization design and clean data modeling.",
        "improvement_suggestions": "Consider adding a drill-through page for regional breakdowns."
    }, headers=admin_headers)
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"
    assert review_res.json()["day_is_completed"] == True

def test_student_referrals_and_bonus_calculation():
    stu_res = client.post("/api/v1/auth/login", json={
        "email": "student@training.local",
        "password": "StudentPass123!"
    })
    stu_headers = {"Authorization": f"Bearer {stu_res.json()['access_token']}"}

    # Reset student referrals for clean test isolation
    from backend.app.db.session import SessionLocal
    from backend.app.models.models import ReferralRecord, User
    db = SessionLocal()
    student = db.query(User).filter(User.email == "student@training.local").first()
    db.query(ReferralRecord).filter(ReferralRecord.referrer_id == student.id).delete()
    db.commit()
    db.close()

    # 1. Fetch referral info
    info_res = client.get("/api/v1/referrals/my-info", headers=stu_headers)
    assert info_res.status_code == 200
    data = info_res.json()
    assert "referral_code" in data
    assert "referral_link" in data
    assert data["campaign"]["base_reward_amount"] == 999.0
    code = data["referral_code"]

    # 2. Student logs an invite
    invite_res = client.post("/api/v1/referrals/invite", json={
        "referred_name": "Sita Verma",
        "referred_email": "sita@example.com",
        "referral_code": code
    }, headers=stu_headers)
    assert invite_res.status_code == 200
    assert invite_res.json()["name"] == "Sita Verma"

    # 3. Friend claims seat via referral code
    claim_res = client.post(f"/api/v1/referrals/claim?code={code}&guest_name=Sita%20Verma&guest_email=sita@example.com")
    assert claim_res.status_code == 200
    assert "claimed successfully" in claim_res.json()["message"]

    # 4. Enforce 5 friends maximum cap: add remaining 4 invites
    for i in range(2, 6):
        res = client.post("/api/v1/referrals/invite", json={
            "referred_name": f"Friend {i}",
            "referred_email": f"friend{i}@example.com",
            "referral_code": code
        }, headers=stu_headers)
        assert res.status_code == 200

    # 5. 6th friend should be rejected with 400 Bad Request
    exceeded_res = client.post("/api/v1/referrals/invite", json={
        "referred_name": "Friend 6",
        "referred_email": "friend6@example.com",
        "referral_code": code
    }, headers=stu_headers)
    assert exceeded_res.status_code == 400
    assert "Maximum referral limit reached" in exceeded_res.json()["detail"]

def test_spreadsheet_performance_report_and_csv_export():
    admin_res = client.post("/api/v1/auth/login", json={
        "email": "admin@training.local",
        "password": "AdminPass123!"
    })
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    # Overview stats
    overview = client.get("/api/v1/reviews/overview", headers=admin_headers)
    assert overview.status_code == 200
    assert "total_students" in overview.json()

    # Dynamic spreadsheet
    sheet = client.get("/api/v1/reviews/spreadsheet", headers=admin_headers)
    assert sheet.status_code == 200
    sheet_data = sheet.json()
    assert "columns" in sheet_data
    assert "rows" in sheet_data
    assert "enrolled_students" in sheet_data

    # Filter spreadsheet by specific student_id if students exist
    if sheet_data["enrolled_students"]:
        target_student_id = sheet_data["enrolled_students"][0]["id"]
        single_sheet = client.get(f"/api/v1/reviews/spreadsheet?student_id={target_student_id}", headers=admin_headers)
        assert single_sheet.status_code == 200
        single_data = single_sheet.json()
        assert len(single_data["rows"]) <= 1

    # CSV Export
    csv_res = client.get("/api/v1/reviews/spreadsheet/export", headers=admin_headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Student Name" in csv_res.text


def test_employee_referral_no_limit_and_admin_approval():
    # 1. Admin login
    admin_res = client.post("/api/v1/auth/login", json={
        "email": "admin@training.local",
        "password": "AdminPass123!"
    })
    assert admin_res.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    # 2. Employee login
    emp_res = client.post("/api/v1/auth/login", json={
        "email": "employee@training.local",
        "password": "EmployeePass123!"
    })
    assert emp_res.status_code == 200
    emp_headers = {"Authorization": f"Bearer {emp_res.json()['access_token']}"}

    # Clean previous employee referral records for test isolation
    from backend.app.db.session import SessionLocal
    from backend.app.models.models import ReferralRecord, User
    db = SessionLocal()
    employee = db.query(User).filter(User.email == "employee@training.local").first()
    emp_id = employee.id
    db.query(ReferralRecord).filter(ReferralRecord.referrer_id == emp_id).delete()
    db.commit()
    db.close()

    # 3. Admin lists user links and assigns official referral link to employee
    links_res = client.get("/api/v1/referrals/user-links", headers=admin_headers)
    assert links_res.status_code == 200
    users_data = links_res.json()
    emp_entry = next((u for u in users_data if u["id"] == emp_id), None)
    assert emp_entry is not None

    custom_link = "https://traininghub.local/join?ref=EMP-OFFICIAL-01"
    custom_code = "EMP-OFFICIAL-01"
    assign_res = client.post(
        f"/api/v1/referrals/user-links/{emp_id}/assign",
        json={
            "referral_code": custom_code,
            "referral_link": custom_link,
            "is_approved": True
        },
        headers=admin_headers
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["referral_link"] == custom_link

    # 4. Employee checks referral info
    emp_info_res = client.get("/api/v1/referrals/my-info", headers=emp_headers)
    assert emp_info_res.status_code == 200
    emp_info = emp_info_res.json()
    assert emp_info["is_employee"] is True
    assert emp_info["max_friends_limit"] is None
    assert emp_info["referral_link"] == custom_link
    assert emp_info["is_link_assigned_by_admin"] is True

    # 5. Employee invites 7 friends (exceeds student 5-limit, demonstrating NO LIMIT for employees)
    records = []
    for i in range(1, 8):
        res = client.post("/api/v1/referrals/invite", json={
            "referred_name": f"Candidate {i}",
            "referred_email": f"candidate{i}@example.com",
            "referral_code": custom_code
        }, headers=emp_headers)
        assert res.status_code == 200
        records.append(res.json())

    assert len(records) == 7

    # 6. Admin views referrals with role filter and approves the first record
    all_refs = client.get("/api/v1/referrals/all?role_filter=employee", headers=admin_headers)
    assert all_refs.status_code == 200
    employee_refs = all_refs.json()
    assert len(employee_refs) >= 7

    rec_to_approve = records[0]["id"]
    review_res = client.post(
        f"/api/v1/referrals/{rec_to_approve}/review",
        json={"reward_status": "approved", "reward_amount": 999.0},
        headers=admin_headers
    )
    assert review_res.status_code == 200
    assert review_res.json()["reward_status"] == "approved"
    assert review_res.json()["reward_amount"] == 999.0



def test_reward_points_and_wallet():
    # 1. Admin login
    admin_res = client.post("/api/v1/auth/login", json={
        "email": "admin@training.local",
        "password": "AdminPass123!"
    })
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Student login
    student_res = client.post("/api/v1/auth/login", json={
        "email": "student@training.local",
        "password": "StudentPass123!"
    })
    student_token = student_res.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    student_id = student_res.json()["user"]["id"]

    # 3. Check reward config (admin)
    cfg_res = client.get("/api/v1/rewards/config", headers=admin_headers)
    assert cfg_res.status_code == 200
    cfg = cfg_res.json()
    assert cfg["point_to_rupee_ratio"] == 1.0  # 1 reward point = ₹1 INR

    # 4. Student checks wallet
    wallet_res = client.get("/api/v1/rewards/wallet", headers=student_headers)
    assert wallet_res.status_code == 200
    w_data = wallet_res.json()
    assert "wallet" in w_data
    assert "monetary_value_inr" in w_data

    # 5. Admin adjustment
    adj_res = client.post(
        "/api/v1/rewards/admin/adjust",
        json={"student_id": student_id, "amount": 50.0, "reason": "Test bonus points"},
        headers=admin_headers
    )
    assert adj_res.status_code == 200
    assert adj_res.json()["points_adjusted"] == 50.0


def test_razorpay_order_and_signature():
    import hmac, hashlib
    from backend.app.services.razorpay_service import verify_razorpay_signature

    test_secret = "test_webhook_secret_key"
    order_id = "order_test_123"
    payment_id = "pay_test_456"

    valid_sig = hmac.new(
        test_secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    assert verify_razorpay_signature(order_id, payment_id, valid_sig, secret_override=test_secret) is True
    assert verify_razorpay_signature(order_id, payment_id, "corrupted_sig", secret_override=test_secret) is False


def test_chat_permissions():
    admin_res = client.post("/api/v1/auth/login", json={
        "email": "admin@training.local",
        "password": "AdminPass123!"
    })
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    student_res = client.post("/api/v1/auth/login", json={
        "email": "student@training.local",
        "password": "StudentPass123!"
    })
    student_headers = {"Authorization": f"Bearer {student_res.json()['access_token']}"}

    # Admin can list conversations
    admin_convs = client.get("/api/v1/chat/conversations", headers=admin_headers)
    assert admin_convs.status_code == 200

    # Student can get contacts (authorized teachers + admin support)
    contacts_res = client.get("/api/v1/chat/contacts", headers=student_headers)
    assert contacts_res.status_code == 200
