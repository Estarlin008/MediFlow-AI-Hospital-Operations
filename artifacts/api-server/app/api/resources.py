from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import add_audit, require_roles
from app.db.session import get_db
from app.models import (
    Consultation,
    Resource,
    ResourceAssignment,
    ResourceStatus,
    ResourceType,
    User,
    UserRole,
)
from app.schemas.api import AssignmentCreate, AssignmentOut, ResourceCreate, ResourceOut, ResourcePatch

router = APIRouter(prefix="/resources", tags=["resources"])
assignments_router = APIRouter(prefix="/resource-assignments", tags=["resources"])
_READ_ROLES = (UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST)
_WRITE_ROLES = (UserRole.ADMIN, UserRole.DOCTOR)


@router.get("", response_model=list[ResourceOut])
def list_resources(
    resource_type: ResourceType | None = None,
    resource_status: ResourceStatus | None = Query(default=None, alias="status"),
    include_inactive: bool = False,
    user: User = Depends(require_roles(*_READ_ROLES)),
    db: Session = Depends(get_db),
) -> list[ResourceOut]:
    del user
    statement = select(Resource)
    if resource_type is not None:
        statement = statement.where(Resource.resource_type == resource_type)
    if resource_status is not None:
        statement = statement.where(Resource.status == resource_status)
    elif not include_inactive:
        statement = statement.where(Resource.status != ResourceStatus.INACTIVE)
    rows = db.scalars(statement.order_by(Resource.name.asc())).all()
    return [ResourceOut.model_validate(row) for row in rows]


@router.post("", response_model=ResourceOut, status_code=status.HTTP_201_CREATED)
def create_resource(
    payload: ResourceCreate,
    user: User = Depends(require_roles(*_WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> ResourceOut:
    resource = Resource(**payload.model_dump())
    db.add(resource)
    add_audit(db, user.id, "resource.create", "resource", resource.id)
    db.commit()
    db.refresh(resource)
    return ResourceOut.model_validate(resource)


@router.get("/{resource_id}", response_model=ResourceOut)
def get_resource(
    resource_id: UUID,
    user: User = Depends(require_roles(*_READ_ROLES)),
    db: Session = Depends(get_db),
) -> ResourceOut:
    del user
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    return ResourceOut.model_validate(resource)


@router.patch("/{resource_id}", response_model=ResourceOut)
def update_resource(
    resource_id: UUID,
    payload: ResourcePatch,
    user: User = Depends(require_roles(*_WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> ResourceOut:
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("status") == ResourceStatus.INACTIVE or updates.get("capacity", resource.capacity) < resource.capacity:
        active_count = db.scalar(
            select(func.count()).select_from(ResourceAssignment).where(
                ResourceAssignment.resource_id == resource.id,
                ResourceAssignment.released_at.is_(None),
            )
        ) or 0
        target_capacity = updates.get("capacity", resource.capacity)
        if active_count > target_capacity:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Release assignments before reducing resource capacity or deactivating it.")
    for key, value in updates.items():
        setattr(resource, key, value)
    add_audit(db, user.id, "resource.update", "resource", resource.id)
    db.commit()
    db.refresh(resource)
    return ResourceOut.model_validate(resource)


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_resource(
    resource_id: UUID,
    user: User = Depends(require_roles(*_WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> Response:
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    active_count = db.scalar(
        select(func.count()).select_from(ResourceAssignment).where(
            ResourceAssignment.resource_id == resource.id,
            ResourceAssignment.released_at.is_(None),
        )
    ) or 0
    if active_count:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Release active assignments before deactivating this resource.")
    resource.status = ResourceStatus.INACTIVE
    add_audit(db, user.id, "resource.deactivate", "resource", resource.id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{resource_id}/assignments", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
def assign_resource(
    resource_id: UUID,
    payload: AssignmentCreate,
    user: User = Depends(require_roles(*_WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> AssignmentOut:
    resource = db.scalar(select(Resource).where(Resource.id == resource_id).with_for_update())
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    if resource.status != ResourceStatus.AVAILABLE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource is not available.")
    if db.get(Consultation, payload.consultation_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found.")
    active_count = db.scalar(
        select(func.count()).select_from(ResourceAssignment).where(
            ResourceAssignment.resource_id == resource.id,
            ResourceAssignment.released_at.is_(None),
        )
    ) or 0
    if active_count >= resource.capacity:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource capacity has been reached.")
    assignment = ResourceAssignment(
        resource_id=resource.id,
        consultation_id=payload.consultation_id,
        assigned_by=user.id,
    )
    db.add(assignment)
    add_audit(db, user.id, "resource.assignment.create", "resource_assignment", assignment.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This resource is already assigned to the consultation.") from None
    db.refresh(assignment)
    return AssignmentOut.model_validate(assignment)


@assignments_router.post("/{assignment_id}/release", response_model=AssignmentOut)
def release_assignment(
    assignment_id: UUID,
    user: User = Depends(require_roles(*_WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> AssignmentOut:
    assignment = db.scalar(select(ResourceAssignment).where(ResourceAssignment.id == assignment_id).with_for_update())
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource assignment not found.")
    if assignment.released_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource assignment was already released.")
    assignment.released_at = datetime.now(timezone.utc)
    add_audit(db, user.id, "resource.assignment.release", "resource_assignment", assignment.id)
    db.commit()
    db.refresh(assignment)
    return AssignmentOut.model_validate(assignment)
