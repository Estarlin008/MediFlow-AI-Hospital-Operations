from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import add_audit, require_roles
from app.db.session import get_db
from app.models import Consultation, Patient, User, UserRole
from app.schemas.api import ConsultationOut, ConsultationPage, PatientCreate, PatientOut, PatientPage, PatientPatch

router = APIRouter(prefix="/patients", tags=["patients"])
_CLINICAL_ROLES = (UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST)


@router.get("", response_model=PatientPage)
def list_patients(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    user: User = Depends(require_roles(*_CLINICAL_ROLES)),
    db: Session = Depends(get_db),
) -> PatientPage:
    del user
    statement = select(Patient)
    count_statement = select(func.count()).select_from(Patient)
    if search and search.strip():
        needle = f"%{search.strip()}%"
        predicate = or_(
            Patient.first_name.ilike(needle),
            Patient.last_name.ilike(needle),
            Patient.medical_record_number.ilike(needle),
            Patient.phone.ilike(needle),
        )
        statement = statement.where(predicate)
        count_statement = count_statement.where(predicate)
    total = db.scalar(count_statement) or 0
    items = db.scalars(
        statement.order_by(Patient.created_at.desc(), Patient.id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return PatientPage(items=[PatientOut.model_validate(item) for item in items], total=total, page=page, page_size=page_size)


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    user: User = Depends(require_roles(*_CLINICAL_ROLES)),
    db: Session = Depends(get_db),
) -> PatientOut:
    record = payload.medical_record_number or f"MF-{uuid4().hex[:12].upper()}"
    patient = Patient(
        medical_record_number=record,
        first_name=payload.first_name,
        last_name=payload.last_name,
        date_of_birth=payload.date_of_birth,
        sex=payload.sex,
        phone=payload.phone.strip() if payload.phone else None,
    )
    db.add(patient)
    add_audit(db, user.id, "patient.create", "patient", patient.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Medical record number is already in use.") from None
    db.refresh(patient)
    return PatientOut.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: UUID,
    user: User = Depends(require_roles(*_CLINICAL_ROLES)),
    db: Session = Depends(get_db),
) -> PatientOut:
    del user
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    return PatientOut.model_validate(patient)


@router.patch("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: UUID,
    payload: PatientPatch,
    user: User = Depends(require_roles(*_CLINICAL_ROLES)),
    db: Session = Depends(get_db),
) -> PatientOut:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, key, value.strip() if key == "phone" and value else value)
    add_audit(db, user.id, "patient.update", "patient", patient.id)
    db.commit()
    db.refresh(patient)
    return PatientOut.model_validate(patient)


@router.get("/{patient_id}/consultations", response_model=ConsultationPage)
def list_patient_consultations(
    patient_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    user: User = Depends(require_roles(*_CLINICAL_ROLES)),
    db: Session = Depends(get_db),
) -> ConsultationPage:
    del user
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    base = select(Consultation).where(Consultation.patient_id == patient_id)
    total = db.scalar(select(func.count()).select_from(Consultation).where(Consultation.patient_id == patient_id)) or 0
    items = db.scalars(base.order_by(Consultation.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return ConsultationPage(
        items=[ConsultationOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
