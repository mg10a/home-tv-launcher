"""Stable, per-hub HA entity keys without altering the physical Eufy serial.

Production entries keep their existing registry identities. Only entries
whose bridge ID was explicitly namespaced by our DEV bridge get a new key.
This prevents a second bridge from silently reusing the production entities.
"""
from __future__ import annotations

_DEV_PREFIX = "home-tv-dev-"


def is_dev_bridge(bridge_id: str) -> bool:
    return bridge_id.startswith(_DEV_PREFIX)


def device_key(bridge_id: str, serial: str) -> str:
    """HA device identifier; physical serial stays unchanged for bridge calls."""
    return f"{bridge_id}:{serial}" if is_dev_bridge(bridge_id) else serial


def entity_key(bridge_id: str, serial: str, kind: str) -> str:
    """HA entity registry key, backwards-compatible for production entities."""
    return f"{device_key(bridge_id, serial)}_{kind}"


def camera_serial(bridge_id: str, unique_id: str) -> str | None:
    """Resolve a camera registry key back to a physical serial, only for its hub."""
    suffix = "_camera"
    if not isinstance(unique_id, str) or not unique_id.endswith(suffix):
        return None
    stem = unique_id[: -len(suffix)]
    if is_dev_bridge(bridge_id):
        prefix = f"{bridge_id}:"
        if not stem.startswith(prefix):
            return None
        return stem[len(prefix):] or None
    # Production preserves its original raw-serial camera registry convention.
    return stem or None
