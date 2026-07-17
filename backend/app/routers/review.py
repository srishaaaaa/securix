"""
Additional Module - Manual Review Queue.

Ported from the reference project's `compliance.ManualReview` model. Lets
admins explicitly pull verifications into a triage queue, assign them to
a reviewer, set a priority, and track status separately from the
verification's own `status` field. This is purely additive: nothing here
changes the existing admin decision endpoint or verification flow, it
just gives admins an extra worklist view on top of it.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth as auth_utils
from ..database import get_db

router = APIRouter(prefix="/api/reviews", tags=["manual-review"])

VALID_PRIORITIES = {"low", "medium", "high", "urgent"}
VALID_STATUSES = {"pending", "in_progress", "completed"}


@router.post("", response_model=schemas.ManualReviewOut)
def create_review(
    payload: schemas.ManualReviewCreate,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    verification = db.query(models.Verification).filter(
        models.Verification.id == payload.verification_id
    ).first()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found.")

    if payload.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid priority value.")

    review = models.ManualReview(
        verification_id=payload.verification_id,
        reason=payload.reason,
        priority=models.ReviewPriority(payload.priority),
        status=models.ReviewStatus.pending,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    db.add(models.AuditLog(
        user_id=admin.id, verification_id=verification.id,
        action="manual_review_created",
        detail=f"Queued for review by {admin.email}: {payload.reason}",
    ))
    db.commit()
    return review


@router.get("", response_model=list[schemas.ManualReviewOut])
def list_reviews(
    status: str | None = None,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.ManualReview)
    if status:
        q = q.filter(models.ManualReview.status == status)
    return q.order_by(models.ManualReview.created_at.desc()).all()


@router.patch("/{review_id}", response_model=schemas.ManualReviewOut)
def update_review(
    review_id: str,
    payload: schemas.ManualReviewUpdate,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    review = db.query(models.ManualReview).filter(models.ManualReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")

    if payload.status is not None:
        if payload.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status value.")
        review.status = models.ReviewStatus(payload.status)
        if payload.status == "completed":
            review.completed_at = datetime.utcnow()

    if payload.priority is not None:
        if payload.priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail="Invalid priority value.")
        review.priority = models.ReviewPriority(payload.priority)

    if payload.assigned_to_id is not None:
        assignee = db.query(models.User).filter(models.User.id == payload.assigned_to_id).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee not found.")
        review.assigned_to_id = payload.assigned_to_id

    if payload.review_notes is not None:
        review.review_notes = payload.review_notes

    db.commit()
    db.refresh(review)

    db.add(models.AuditLog(
        user_id=admin.id, verification_id=review.verification_id,
        action="manual_review_updated",
        detail=f"Updated by {admin.email}: status={review.status.value}, priority={review.priority.value}",
    ))
    db.commit()
    return review
