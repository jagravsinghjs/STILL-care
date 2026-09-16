"""Account creation primitives used by the HTTP auth endpoints.

Password hashes use PBKDF2-HMAC-SHA256 from Python's standard library.  This
keeps the initial service runnable with the repository's declared runtime
dependencies; token issuance is added with the login endpoint.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import os
import re
import sqlite3
import json


USER_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$")
PBKDF2_ITERATIONS = 600_000
ACCESS_TOKEN_LIFETIME = timedelta(hours=8)


class RegistrationError(ValueError):
    """A safe validation error suitable for returning to a caller."""


class DuplicateAccountError(RegistrationError):
    """The requested user ID has already been registered."""


class AuthenticationError(ValueError):
    """Credentials or a bearer token could not be authenticated."""


@dataclass(frozen=True)
class Account:
    user_id: str
    display_name: str
    role: str


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations, salt, expected = stored_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        candidate = _hash_password(password, base64.urlsafe_b64decode(salt.encode("ascii")))
        return hmac.compare_digest(candidate, stored_hash)
    except (ValueError, TypeError):
        return False


def authenticate(conn: sqlite3.Connection, *, user_id: str, password: str) -> Account:
    """Look up an account without revealing whether its ID exists."""
    row = conn.execute(
        "SELECT user_id, display_name, role, password_hash FROM accounts WHERE user_id = ?", (user_id.strip(),)
    ).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        raise AuthenticationError("Invalid user ID or password.")
    return Account(user_id=row["user_id"], display_name=row["display_name"], role=row["role"])


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _jwt_secret() -> bytes:
    secret = os.environ.get("STILL_JWT_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("STILL_JWT_SECRET must be set to at least 32 characters.")
    return secret.encode("utf-8")


def issue_access_token(account: Account, now: datetime | None = None) -> str:
    """Issue an HS256 JWT; the corresponding decoder is used by later routes."""
    now = now or datetime.now(timezone.utc)
    header = _base64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _base64url(
        json.dumps(
            {
                "sub": account.user_id,
                "role": account.role,
                "iat": int(now.timestamp()),
                "exp": int((now + ACCESS_TOKEN_LIFETIME).timestamp()),
            },
            separators=(",", ":"),
        ).encode()
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    signature = _base64url(hmac.new(_jwt_secret(), signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def decode_access_token(token: str, now: datetime | None = None) -> dict[str, object]:
    """Validate a token's signature, claims, and expiry before trusting it."""
    try:
        header, payload, signature = token.split(".")
        signing_input = f"{header}.{payload}".encode("ascii")
        expected = _base64url(hmac.new(_jwt_secret(), signing_input, hashlib.sha256).digest())
        claims = json.loads(_base64url_decode(payload))
        if not hmac.compare_digest(signature, expected):
            raise AuthenticationError("Invalid access token.")
        if not isinstance(claims.get("sub"), str) or claims.get("role") not in {"STUDENT", "SUPERVISOR"}:
            raise AuthenticationError("Invalid access token.")
        if int(claims["exp"]) <= int((now or datetime.now(timezone.utc)).timestamp()):
            raise AuthenticationError("Access token has expired.")
        return claims
    except (KeyError, TypeError, ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        if isinstance(exc, AuthenticationError):
            raise
        raise AuthenticationError("Invalid access token.") from exc


def register_student(conn: sqlite3.Connection, *, user_id: str, name: str, password: str) -> Account:
    """Register a patient account; public registration never creates supervisors."""
    user_id = user_id.strip()
    name = name.strip()
    if not USER_ID_PATTERN.fullmatch(user_id):
        raise RegistrationError("User ID must be 3–40 letters, numbers, dots, hyphens, or underscores.")
    if not 1 <= len(name) <= 80:
        raise RegistrationError("Full name must be between 1 and 80 characters.")
    if len(password) < 8:
        raise RegistrationError("Password must contain at least 8 characters.")
    try:
        conn.execute(
            """INSERT INTO accounts (user_id, display_name, role, password_hash, created_at)
               VALUES (?, ?, 'STUDENT', ?, ?)""",
            (user_id, name, _hash_password(password), datetime.now(timezone.utc).isoformat()),
        )
    except sqlite3.IntegrityError as exc:
        raise DuplicateAccountError("That user ID is already registered.") from exc
    return Account(user_id=user_id, display_name=name, role="STUDENT")
