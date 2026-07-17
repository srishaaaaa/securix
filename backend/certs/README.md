# certs/

- `test_uidai_cert.pem` / `test_uidai_private_key.pem` - a locally-generated,
  self-signed **test** keypair used by the Aadhaar Secure QR module
  (`app/services/aadhaar_qr.py`) so the feature is demoable without
  needing UIDAI's real certificate. Verifying a *real* Aadhaar card
  against this test cert will correctly report `signature_valid: false`
  - that's expected, not a bug, since a real card was never signed by
  this test key.

- `scripts/generate_test_aadhaar_qr.py` (in `backend/scripts/`) uses
  `test_uidai_private_key.pem` to generate a fake Aadhaar card image with
  a genuinely, correctly signed Secure QR code, so you can see the module
  report `signature_valid: true` end to end.

## Going live with real Aadhaar cards

1. Download UIDAI's current signing certificate from uidai.gov.in.
2. Convert to PEM if needed: `openssl x509 -inform der -in uidai.cer -out uidai_cert.pem`
3. Save it as `backend/certs/uidai_cert.pem` (this exact filename/path is
   checked automatically), or point `UIDAI_CERT_PATH` at wherever you put it.
4. Restart the backend. No code changes needed - `aadhaar_qr.py` prefers
   a real cert at that path over the bundled test one automatically.

## Regenerating the test keypair

Not normally necessary, but if you want a fresh one:

```bash
python3 - <<'EOF'
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import hashes, serialization
from cryptography import x509
from cryptography.x509.oid import NameOID
import datetime

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SECURIX Test Certificate Authority"),
    x509.NameAttribute(NameOID.COMMON_NAME, "SECURIX-TEST-AADHAAR-QR (NOT UIDAI - see README)"),
])
cert = (
    x509.CertificateBuilder()
    .subject_name(subject).issuer_name(issuer).public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.utcnow())
    .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=3650))
    .sign(key, hashes.SHA256())
)
open("test_uidai_private_key.pem", "wb").write(key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
))
open("test_uidai_cert.pem", "wb").write(cert.public_bytes(serialization.Encoding.PEM))
EOF
```
