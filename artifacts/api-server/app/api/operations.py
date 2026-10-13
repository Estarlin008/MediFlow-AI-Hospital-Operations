from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models import (
    AuditLog,
    Patient,
    Priority,
    QueueEntry,
    QueueStatus,
    Resource,
    ResourceStatus,
    ResourceType,
    User,
    UserRole,
)
from app.schemas.api import AuditOut, DashboardSummary

router = APIRouter(tags=["dashboard", "audit"])
_READ_ROLES = (UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST)


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    user: User = Depends(require_roles(*_READ_ROLES)),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    del user
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    patients_today = db.scalar(
        select(func.count()).select_from(Patient).where(Patient.created_at >= today_start)
    ) or 0
    active_consultations = db.scalar(
        select(func.count()).select_from(QueueEntry).where(
            QueueEntry.status.in_([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS])
        )
    ) or 0
    critical_queue_count = db.scalar(
        select(func.count()).select_from(QueueEntry).where(
            QueueEntry.priority == Priority.P1,
            QueueEntry.status.in_([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS]),
        )
    ) or 0
    waiting_queue_count = db.scalar(
        select(func.count()).select_from(QueueEntry).where(QueueEntry.status == QueueStatus.WAITING)
    ) or 0
    average_seconds = db.scalar(
        select(func.avg(func.extract("epoch", now - QueueEntry.queued_at))).where(
            QueueEntry.status == QueueStatus.WAITING
        )
    )
    beds = db.execute(
        select(
            func.count(Resource.id),
            func.count(Resource.id).filter(Resource.status == ResourceStatus.AVAILABLE),
        ).where(
            Resource.resource_type == ResourceType.BED,
            Resource.status != ResourceStatus.INACTIVE,
        )
    ).one()
    return DashboardSummary(
        patients_today=int(patients_today),
        active_consultations=int(active_consultations),
        critical_queue_count=int(critical_queue_count),
        waiting_queue_count=int(waiting_queue_count),
        average_wait_minutes=round(float(average_seconds) / 60, 1) if average_seconds is not None else None,
        available_beds=int(beds[1] or 0),
        total_beds=int(beds[0] or 0),
        last_synchronized_at=now,
    )


@router.get("/audit", response_model=list[AuditOut])
def list_audit_events(
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> list[AuditOut]:
    del user
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return [AuditOut.model_validate(row) for row in rows]
