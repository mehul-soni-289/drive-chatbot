"""
Google OAuth 2.0 + JWT session management for multi-user support.

Handles:
  - /oauth/login          → Redirects to Google consent screen
  - /oauth/callback       → Exchanges auth code for tokens, returns JWT
  - /oauth/me             → Returns current user info
  - /oauth/logout         → Invalidates session

Tokens are stored per-user in memory.  For production, replace
`_token_store` with a database-backed store.
"""

import json
import logging
import os

# Allow Google to return more scopes than we requested (e.g. from prior grants)
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/oauth", tags=["auth"])

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CLIENT_SECRETS_FILE = os.getenv("GOOGLE_CLIENT_SECRETS", "credentials.json")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-use-a-real-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
]

# In-memory per-user credential store  {email: Credentials}
_token_store: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_flow(redirect_uri: str) -> Flow:
    """Build an OAuth flow from credentials.json."""
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )
    return flow


def create_jwt(email: str, name: str, picture: str = "") -> str:
    """Create a signed JWT for the user."""
    payload = {
        "sub": email,
        "name": name,
        "picture": picture,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt(token: str) -> dict:
    """Decode and verify a JWT.  Raises on invalid/expired tokens."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token.")


def get_current_user(request: Request) -> dict:
    """Extract the current user from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")
    token = auth_header[len("Bearer "):]
    return verify_jwt(token)


def get_user_credentials(email: str) -> Optional[Credentials]:
    """Get stored Google credentials for a user."""
    cred_data = _token_store.get(email)
    if not cred_data:
        return None
    creds = Credentials(
        token=cred_data["token"],
        refresh_token=cred_data.get("refresh_token"),
        token_uri=cred_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=cred_data.get("client_id"),
        client_secret=cred_data.get("client_secret"),
        scopes=cred_data.get("scopes"),
    )
    return creds


def store_user_credentials(email: str, credentials: Credentials):
    """Store Google credentials for a user."""
    _token_store[email] = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes) if credentials.scopes else [],
    }
    logger.info("Stored credentials for user: %s", email)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/login")
async def login(request: Request):
    """Redirect the user to Google's OAuth consent screen."""
    redirect_uri = str(request.url_for("auth_callback"))
    flow = _get_flow(redirect_uri)

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )
    logger.info("Redirecting to Google OAuth: %s", auth_url[:80])
    return RedirectResponse(url=auth_url)


@router.get("/callback", name="auth_callback")
async def callback(request: Request):
    """
    Google redirects here after user consents.
    Exchange the auth code for tokens, fetch user info, create JWT.
    """
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    redirect_uri = str(request.url_for("auth_callback"))
    flow = _get_flow(redirect_uri)

    try:
        flow.fetch_token(code=code)
    except Exception as exc:
        logger.error("Token exchange failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {exc}")

    credentials = flow.credentials

    # Fetch user info from Google
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {credentials.token}"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info.")
        user_info = resp.json()

    email = user_info.get("email", "unknown@unknown.com")
    name = user_info.get("name", "User")
    picture = user_info.get("picture", "")

    # Store credentials keyed by email
    store_user_credentials(email, credentials)

    # Create JWT
    token = create_jwt(email, name, picture)

    logger.info("User authenticated: %s (%s)", name, email)

    # Redirect to frontend with the JWT in the URL
    frontend_redirect = f"{FRONTEND_URL}?token={token}&name={name}&email={email}&picture={picture}"
    return RedirectResponse(url=frontend_redirect)


@router.get("/me")
async def me(request: Request):
    """Return info about the currently authenticated user."""
    user = get_current_user(request)
    return {
        "email": user["sub"],
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
    }


@router.post("/logout")
async def logout(request: Request):
    """Remove stored credentials for the current user."""
    user = get_current_user(request)
    email = user["sub"]
    _token_store.pop(email, None)
    logger.info("User logged out: %s", email)
    return {"status": "ok", "message": "Logged out successfully."}
