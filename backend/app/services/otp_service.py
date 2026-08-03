import random
from fastapi import HTTPException
import hashlib
from app.core.redis import redis_client
from app.core.jwt import create_access_token
from app.models.customer import Customer


OTP_TTL = 300        # 5 min
MAX_ATTEMPTS = 3

def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()

# -------------------------------
# Generate OTP
# -------------------------------
def generate_otp():
    return str(random.randint(100000, 999999))


# -------------------------------
# Request OTP
# -------------------------------
def request_otp(phone: str):

    otp = generate_otp()

    key = f"otp:{phone}"

    # Save OTP (auto expire)
    hashed = hash_otp(otp)
    redis_client.setex(key, OTP_TTL, hashed)


    # Reset attempts
    redis_client.delete(f"otp_attempt:{phone}")

    # Send SMS (mock)
    print(f"OTP sent to {phone}: {otp}")

    return {
        "message": "OTP sent",
        "otp": otp   # 👈 For test
    }

# -------------------------------
# Verify OTP
# -------------------------------
def verify_otp(db, phone: str, otp: str):

    otp_key = f"otp:{phone}"
    attempt_key = f"otp_attempt:{phone}"

    saved_otp = redis_client.get(otp_key)

    if saved_otp:
        saved_otp = saved_otp
        


    # OTP expired / not found
    if not saved_otp:
        raise HTTPException(400, "OTP expired or not found")

    # Rate limit
    attempts = redis_client.get(attempt_key)

    if attempts:
        attempts = int(attempts.decode())
    else:
        attempts = 0


    if attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many attempts")
        
    otp = hash_otp(otp)
    # Wrong OTP
    if saved_otp != otp:

        redis_client.incr(attempt_key)
        redis_client.expire(attempt_key, OTP_TTL)

        raise HTTPException(400, "Invalid OTP")

    # ---------------- SUCCESS ----------------

    # Remove OTP
    redis_client.delete(otp_key)
    redis_client.delete(attempt_key)

    # Get / Create customer
    customer = db.query(Customer).filter(
        Customer.phone == phone
    ).first()

    if not customer:
        customer = Customer(phone=phone)
        db.add(customer)
        db.flush()

    db.commit()

    # JWT
    token = create_access_token({
        "sub": str(customer.id),
        "type": "customer"
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }
