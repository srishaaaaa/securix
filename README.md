# SECURIX — AI-Powered Digital KYC Verification & Fraud Detection System

A working, end-to-end implementation of the SECURIX KYC pipeline: document OCR,
face verification with multi-frame liveness detection, a weighted fraud/risk
engine, an automated decision engine, and an admin console — wrapped in a
dark, cyber-security-themed React frontend.

```
securix/
├── backend/     FastAPI + SQLite, all AI/CV logic
└── frontend/    React + Vite + Tailwind
```

## Quick start

### 1. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt --break-system-packages   # drop the flag inside a venv

# Tesseract OCR must be installed on the system (not just the Python wrapper):
#   Ubuntu/Debian: sudo apt-get install tesseract-ocr
#   macOS:         brew install tesseract
#   Windows:       https://github.com/UB-Mannheim/tesseract/wiki

uvicorn app.main:app --reload --port 8000
```

The API is now live at `http://localhost:8000` (interactive docs at `/docs`).
A SQLite file `securix.db` is created automatically, along with a seeded
admin account:

- **Email:** `admin@securix.io`
- **Password:** `Admin@123`

Change or remove this in `app/main.py` (`_seed_admin`) before any real deployment.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env     # adjust VITE_API_URL if your backend isn't on :8000
npm run dev
```

Visit `http://localhost:5173`. Register a customer account, or log in as the
seeded admin to see the console.

The face-verification step needs a webcam and a browser permission prompt —
run it over `localhost` or HTTPS (browsers block camera access on plain HTTP
over a network IP).

## What's real vs. what's a stand-in

This was built to actually run, end-to-end, without any paid API keys, GPU,
or multi-gigabyte model downloads. Being upfront about where it's a
faithful demo versus production-grade:

| Module | Implementation | Production-grade alternative |
|---|---|---|
| OCR & field extraction | **Real** Tesseract OCR + regex field parsing, run on the actual uploaded image | Same idea, tune the regexes per real document layouts |
| Document format validation | Structural checks (PAN regex, Aadhaar length/digit sanity, passport pattern) | Full checksum algorithms + live UIDAI/NSDL/passport-office verification APIs |
| Document authenticity / tamper check | Lightweight Error-Level-Analysis-style recompression diff | Dedicated forensics models, hologram/microprint detection |
| Face detection & matching | **Real** OpenCV Haar-cascade detection + ORB keypoint matching between selfie and document photo | Embedding-based matchers (FaceNet/ArcFace via `face_recognition` or `deepface`) |
| Liveness detection | **Real**, but single-session: analyzes a burst of webcam frames for sharpness, natural inter-frame motion, and blink variation | Active challenge-response (e.g. "turn your head," randomized prompts) + anti-spoof deep models |
| Fraud / risk engine | **Real**, deterministic weighted scoring (OCR 25% / face 30% / liveness 20% / authenticity 25%) plus duplicate-identity and tamper penalties | Same weighting logic typically stays rule-based even in production; add ML-based anomaly detection on top |
| Decision engine, admin console, audit log | **Real**, fully functional | Same, harden auth/roles for multi-admin use |

Everything in the "Real" column actually executes the described algorithm —
nothing is a randomly-generated placeholder number. The tradeoffs are all
about *accuracy* (a Haar cascade / ORB matcher is far less accurate than a
modern deep face-recognition model), not about faking the pipeline.

## Tech stack

**Backend:** FastAPI, SQLAlchemy, SQLite, python-jose (JWT), bcrypt,
Tesseract OCR (via pytesseract), OpenCV, NumPy, Pillow

**Frontend:** React 19, Vite, Tailwind CSS, React Router, Recharts,
Framer Motion, lucide-react icons, Axios

## API overview

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/register` / `/login` | Account creation & JWT login |
| `POST /api/kyc/document` | Upload ID document → OCR + format/authenticity check |
| `POST /api/kyc/face/{verification_id}` | Upload a webcam frame burst → face match + liveness |
| `POST /api/kyc/finalize/{verification_id}` | Run the risk engine → final decision |
| `GET /api/kyc/mine` | The logged-in user's verification history |
| `GET /api/admin/stats` | Aggregate dashboard metrics |
| `GET /api/admin/verifications` | All verifications, filterable by status |
| `POST /api/admin/verifications/{id}/decision` | Manual override |
| `GET /api/admin/audit-logs` | Full audit trail |

Swap `DATABASE_URL` (env var) for a Postgres/MySQL connection string to move
off SQLite — the SQLAlchemy models are unchanged either way.

## Notes for going further

- The frontend already has hooks for the admin decision workflow — you could
  add per-verification detail pages showing the uploaded document/selfie.
- Ideas for extending fraud detection further (device fingerprinting,
  cross-document consistency checks, synthetic-identity graph analysis,
  verifiable-credential issuance) were discussed earlier and aren't wired up
  here, but the risk engine (`backend/app/services/risk.py`) is built to
  accept additional signals easily.
