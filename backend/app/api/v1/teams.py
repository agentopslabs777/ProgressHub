from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import Team, TeamMembership, User
from backend.app.schemas.schemas import TeamCreate, TeamUpdate, TeamResponse, TeamMemberResponse
from backend.app.permissions.permissions import get_current_user, require_admin, log_audit

router = APIRouter(prefix="/teams", tags=["Teams"])

@router.get("", response_model=List[dict])
def list_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    teams = db.query(Team).order_by(Team.created_at.desc()).all()
    results = []
    for t in teams:
        memberships = db.query(TeamMembership).filter(TeamMembership.team_id == t.id).all()
        members = []
        for m in memberships:
            emp = db.query(User).filter(User.id == m.employee_id).first()
            if emp:
                members.append({
                    "employee_id": emp.id,
                    "employeeId": emp.id,
                    "full_name": emp.full_name,
                    "fullName": emp.full_name,
                    "email": emp.email,
                    "joined_at": m.joined_at,
                    "joinedAt": m.joined_at
                })

        results.append({
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "active": t.active,
            "created_at": t.created_at,
            "createdAt": t.created_at,
            "member_count": len(members),
            "memberCount": len(members),
            "members": members
        })
    return results

@router.post("", response_model=TeamResponse)
def create_team(
    data: TeamCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    name = data.name.strip()
    existing = db.query(Team).filter(Team.name.ilike(name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A team with this name already exists")

    team = Team(name=name, description=data.description, active=data.active)
    db.add(team)
    db.commit()
    db.refresh(team)

    log_audit(
        db=db,
        actor=current_user,
        action="CREATE_TEAM",
        target_type="team",
        target_id=team.id,
        details=f"Team '{team.name}' created"
    )

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        active=team.active,
        created_at=team.created_at,
        updated_at=team.updated_at,
        member_count=0,
        members=[]
    )

@router.patch("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: str,
    data: TeamUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if data.name:
        name = data.name.strip()
        existing = db.query(Team).filter(Team.name.ilike(name), Team.id != team_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Team name already in use")
        team.name = name

    if data.description is not None:
        team.description = data.description
    if data.active is not None:
        team.active = data.active

    db.commit()
    db.refresh(team)

    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_TEAM",
        target_type="team",
        target_id=team.id,
        details=f"Team '{team.name}' updated"
    )

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        active=team.active,
        created_at=team.created_at,
        updated_at=team.updated_at,
        member_count=db.query(TeamMembership).filter(TeamMembership.team_id == team.id).count(),
        members=[]
    )

@router.post("/{team_id}/members")
def assign_employee_to_team(
    team_id: str,
    employee_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    emp = db.query(User).filter(User.id == employee_id, User.role == "employee").first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = db.query(TeamMembership).filter(
        TeamMembership.team_id == team_id,
        TeamMembership.employee_id == employee_id
    ).first()
    if existing:
        return {"message": "Employee already a member of this team"}

    membership = TeamMembership(team_id=team_id, employee_id=employee_id)
    db.add(membership)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="ASSIGN_TEAM_MEMBER",
        target_type="team",
        target_id=team.id,
        details=f"Assigned {emp.full_name} to team '{team.name}'"
    )

    return {"message": f"Assigned {emp.full_name} to {team.name}"}

@router.delete("/{team_id}/members/{employee_id}")
def remove_employee_from_team(
    team_id: str,
    employee_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    membership = db.query(TeamMembership).filter(
        TeamMembership.team_id == team_id,
        TeamMembership.employee_id == employee_id
    ).first()

    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    db.delete(membership)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="REMOVE_TEAM_MEMBER",
        target_type="team",
        target_id=team_id,
        details=f"Removed employee {employee_id} from team"
    )

    return {"message": "Employee removed from team"}
