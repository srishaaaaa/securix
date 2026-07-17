"""
Additional Module 3 - Fraud Network (admin-facing endpoint).

Kept as its own router, admin-only, because the graph can reveal another
user's phone number / document number once two verifications are linked -
that's cross-user data a regular customer should never see about someone
else, so this is deliberately not exposed under /api/kyc.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth as auth_utils
from ..database import get_db
from ..services import fraud_graph as fraud_graph_service

router = APIRouter(prefix="/api/fraud", tags=["fraud-network"])


@router.get("/{verification_id}/network", response_model=schemas.FraudNetworkOut)
def get_fraud_network(
    verification_id: str,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    verification = db.query(models.Verification).filter(models.Verification.id == verification_id).first()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found.")

    graph = fraud_graph_service.build_graph(db, verification_id)
    return graph
