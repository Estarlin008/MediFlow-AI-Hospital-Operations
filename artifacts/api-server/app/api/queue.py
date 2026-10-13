from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import add_audit, require_roles
from app.db.session import get_db
from app.models import Priority, QueueEntry, QueueStatus, User, UserRole
from app.schemas.api import QueueOut, QueueStatusInput

router = APIRouter(prefix="/queue", tags=["queue"])
_QUEUE_ROLES = (UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST)
_ALLOWED_TRANSITIONS = {
    QueueStatus.WAITING: {QueueStatus.CALLED, QueueStatus.CANCELLED},
    QueueStatus.CALLED: {QueueStatus.IN_PROGRESS, QueueStatus.WAITING, QueueStatus.CANCELLED},
    QueueStatus.IN_PROGRESS: {QueueStatus.COMPLETED, QueueStatus.WAITING, QueueStatus.CANCELLED},
    QueueStatus.COMPLETED: set(),
    QueueStatus.CANCELLED: set(),
}


@router.get("", response_model=list[QueueOut])
def list_queue(
    status_filter: QueueStatus | None = Query(default=None, alias="status"),
    priority: Priority | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(require_roles(*_QUEUE_ROLES)),
    db: Session = Depends(get_db),
) -> list[QueueOut]:
    del user
    statement = select(QueueEntry)
    if status_filter is not None:
        statement = statement.where(QueueEntry.status == status_filter)
    if priority is not None:
        statement = statement.where(QueueEntry.priority == priority)
    entries = db.scalars(statement.order_by(QueueEntry.queued_at.asc()).limit(limit)).all()
    return [QueueOut.model_validate(entry) for entry in entries]


@router.get("/{entry_id}", response_model=QueueOut)
def get_queue_entry(
    entry_id: UUID,
    user: User = Depends(require_roles(*_QUEUE_ROLES)),
    db: Session = Depends(get_db),
) -> QueueOut:
    del user
    entry = db.get(QueueEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue entry not found.")
    return QueueOut.model_validate(entry)


@router.patch("/{entry_id}/status", response_model=QueueOut)
def update_queue_status(
    entry_id: UUID,
    payload: QueueStatusInput,
    user: User = Depends(require_roles(*_QUEUE_ROLES)),
    db: Session = Depends(get_db),
) -> QueueOut:
    entry = db.get(QueueEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue entry not found.")
    if payload.status != entry.status and payload.status not in _ALLOWED_TRANSITIONS[entry.status]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Queue status transition is not allowed.")
    now = datetime.now(timezone.utc)
    entry.status = payload.status
    if payload.status == QueueStatus.CALLED and entry.called_at is None:
        entry.called_at = now
    if payload.status in (QueueStatus.COMPLETED, QueueStatus.CANCELLED):
        entry.completed_at = now
    add_audit(db, user.id, "queue.status.update", "queue_entry", entry.id)
    db.commit()
    db.refresh(entry)
    return QueueOut.model_validate(entry)
