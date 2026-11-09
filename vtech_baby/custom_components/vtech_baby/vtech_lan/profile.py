"""Explicit connection profiles; never downgrade automatically on a rejection.

The legacy IOTC sentinel is not a password and supplies no IOTC key authentication.
vtech-link's password-derived DTLS and AV login remain mandatory in both profiles.
The RM7767 profile is a candidate, not verified firmware support.
"""
from dataclasses import replace

from .provision import Credentials

KEY_AUTH = "key_auth"
RM7767_DTLS = "rm7767_dtls"
CONF_PROFILE = "connection_profile"
LEGACY_IOTC_SENTINEL = "00000000"


def select_credentials(creds: Credentials, profile: str = KEY_AUTH) -> Credentials:
    if profile == KEY_AUTH:
        return creds
    if profile != RM7767_DTLS:
        raise ValueError("Unknown connection profile")
    if not creds.name.upper().startswith("VTECH_7767_"):
        raise ValueError("RM7767 profile requires an RM7767 pairing QR")
    if not creds.av_password or not creds.account:
        raise ValueError("Password authentication is required")
    return replace(creds, authkey=LEGACY_IOTC_SENTINEL)
