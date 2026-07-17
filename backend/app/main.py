from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine, SessionLocal
from .routers import auth, kyc, admin, review, fraud, integrations, partner_api, video_kyc
from . import auth as auth_utils

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SECURIX API",
    description="AI-Powered Digital KYC Verification and Fraud Detection System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(kyc.router)
app.include_router(admin.router)
app.include_router(review.router)
app.include_router(fraud.router)
app.include_router(integrations.router)
app.include_router(partner_api.router)
app.include_router(video_kyc.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SECURIX API"}


def _seed_admin():
    """Creates a default admin account on first run so the dashboard is
    reachable immediately: admin@securix.io / Admin@123 (change in production)."""
    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.email == "admin@securix.io").first()
        if not existing:
            admin_user = models.User(
                full_name="SECURIX Admin",
                email="admin@securix.io",
                mobile="0000000000",
                password_hash=auth_utils.hash_password("Admin@123"),
                role=models.UserRole.admin,
            )
            db.add(admin_user)
            db.commit()
    finally:
        db.close()


_seed_admin()
