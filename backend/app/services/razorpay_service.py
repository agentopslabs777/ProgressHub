import hmac
import hashlib
from typing import Dict, Any, Optional, Tuple
try:
    import httpx
except ImportError:
    httpx = None
from fastapi import HTTPException
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.db.session import SessionLocal
from backend.app.models.models import RazorpaySetting

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"

def get_razorpay_credentials(db: Optional[Session] = None) -> Tuple[str, str, str, bool]:
    """
    Returns (key_id, key_secret, webhook_secret, is_test_mode).
    Prioritizes active admin database configuration over environment variables.
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        cfg = db.query(RazorpaySetting).filter(RazorpaySetting.is_active == True).first()
        if cfg and cfg.key_id and cfg.key_secret:
            return cfg.key_id, cfg.key_secret, cfg.webhook_secret or "", cfg.is_test_mode
    except Exception:
        pass
    finally:
        if close_db:
            db.close()

    # Fallback to environment configuration
    return (
        settings.RAZORPAY_KEY_ID or "",
        settings.RAZORPAY_KEY_SECRET or "",
        settings.RAZORPAY_WEBHOOK_SECRET or "",
        True
    )

def is_razorpay_configured(db: Optional[Session] = None) -> bool:
    key_id, key_secret, _, _ = get_razorpay_credentials(db)
    return bool(key_id and key_secret)

async def test_razorpay_credentials(key_id: str, key_secret: str) -> Tuple[bool, str]:
    """
    Tests live connection against Razorpay API using basic auth.
    """
    if not key_id or not key_secret:
        return False, "Key ID and Key Secret must both be provided."

    auth = (key_id.strip(), key_secret.strip())
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(f"{RAZORPAY_API_BASE}/orders?count=1", auth=auth)
            if res.status_code == 200:
                return True, "Successfully authenticated with Razorpay API."
            elif res.status_code == 401:
                return False, "Authentication failed: Invalid Key ID or Key Secret."
            else:
                data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                err = data.get("error", {}).get("description", res.text)
                return False, f"Razorpay API returned status {res.status_code}: {err}"
    except Exception as e:
        return False, f"Connection error: {str(e)}"

async def create_razorpay_order(
    amount_inr: float,
    receipt: str,
    notes: Optional[Dict[str, str]] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Creates an order in Razorpay using the Orders API.
    Amount is converted to paise (1 INR = 100 paise).
    """
    key_id, key_secret, _, _ = get_razorpay_credentials(db)
    if not (key_id and key_secret):
        raise HTTPException(
            status_code=400,
            detail="Razorpay credentials are not connected. Please connect your Razorpay account in the Admin Panel."
        )

    # Convert to integer paise
    amount_paise = int(round(amount_inr * 100))
    if amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Order amount must be greater than zero.")

    payload = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,
        "notes": notes or {}
    }

    auth = (key_id, key_secret)

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            response = await client.post(
                f"{RAZORPAY_API_BASE}/orders",
                json=payload,
                auth=auth
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to communicate with Razorpay API: {str(e)}")

        if response.status_code != 200:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            err_msg = error_data.get("error", {}).get("description") or f"Razorpay order creation failed: {response.text}"
            raise HTTPException(status_code=response.status_code, detail=err_msg)

        return response.json()

def verify_razorpay_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    secret_override: Optional[str] = None,
    db: Optional[Session] = None
) -> bool:
    """
    Verifies payment signature from Razorpay Checkout:
    signature = hmac_sha256(order_id + "|" + payment_id, key_secret)
    """
    if secret_override:
        secret_key = secret_override
    else:
        _, secret_key, _, _ = get_razorpay_credentials(db)

    if not secret_key:
        return False

    message = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
    secret = secret_key.encode("utf-8")
    expected_signature = hmac.new(secret, message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_signature, razorpay_signature)

def verify_webhook_signature(
    payload_body: bytes,
    signature_header: str,
    db: Optional[Session] = None
) -> bool:
    """
    Verifies webhook signature sent in X-Razorpay-Signature header:
    signature = hmac_sha256(payload_body, webhook_secret)
    """
    _, _, webhook_secret, _ = get_razorpay_credentials(db)
    if not webhook_secret:
        return False

    secret = webhook_secret.encode("utf-8")
    expected_signature = hmac.new(secret, payload_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_signature, signature_header)
