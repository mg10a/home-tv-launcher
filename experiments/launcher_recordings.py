"""Experimental authenticated Eufy recording metadata and thumbnail WebSocket API.

NOT INSTALLED. Add async_register_recording_commands(hass) to integration
async_setup after existing async_register_commands(hass). Review and test on
a separate Home Assistant environment before deploying.

Requires the upstream keesmod/ha-eufy-cam integration modules.
"""
from __future__ import annotations

import asyncio
import base64
import re

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .coordinator import EufyCoordinator

_ENTITY = re.compile(r"camera\.[a-z0-9_]+\Z")
_DATE = re.compile(r"\d{4}-\d{2}-\d{2}\Z")
_ID = re.compile(r"[a-f0-9]{32}\Z")
_MAX_EVENTS = 10000
_MAX_JPEG = 1_000_000


def _camera(hass, connection, entity_id: str) -> tuple[EufyCoordinator, str]:
    if not connection.user.permissions.check_entity(entity_id, POLICY_READ):
        raise PermissionError("Camera access denied")
    entity = er.async_get(hass).async_get(entity_id)
    entry = (hass.config_entries.async_get_entry(entity.config_entry_id)
             if entity and entity.config_entry_id else None)
    if (not entity or entity.platform != DOMAIN or entity.domain != "camera"
            or entity.disabled or not entry or not hasattr(entry, "runtime_data")):
        raise LookupError("Camera unavailable")
    coordinator = entry.runtime_data
    serial = entity.unique_id.removesuffix("_camera")
    if (not coordinator.data or serial not in coordinator.data.cameras
            or not coordinator.last_update_success
            or coordinator.data.auth != "connected"
            or not coordinator.data.cameras[serial].permits("recordings")):
        raise LookupError("Recordings unavailable")
    return coordinator, serial


def _error(connection, msg, exc: Exception) -> None:
    if isinstance(exc, PermissionError):
        connection.send_error(msg["id"], "unauthorized", "Camera access denied")
    elif isinstance(exc, (LookupError, ValueError)):
        connection.send_error(msg["id"], "unavailable", str(exc))
    else:
        connection.send_error(msg["id"], "bridge_error", "Eufy recording request failed")


@websocket_api.websocket_command({
    vol.Required("type"): "eufy_viewer/launcher_events",
    vol.Required("entity_id"): vol.Match(_ENTITY.pattern),
    vol.Required("date"): vol.Match(_DATE.pattern),
})
@websocket_api.async_response
async def launcher_events(hass, connection, msg):
    try:
        coordinator, serial = _camera(hass, connection, msg["entity_id"])
        async with asyncio.timeout(30):
            data = await coordinator.api.request(
                "GET", f"/v1/recordings?cameras={serial}&date={msg['date']}"
            )
        values = data.get("recordings") if isinstance(data, dict) else None
        if (not isinstance(data, dict) or data.get("complete") is not True or not isinstance(values, list)
                or len(values) > _MAX_EVENTS):
            raise ValueError("Incomplete or excessive history")
        rows = []
        for row in values:
            if (not isinstance(row, dict) or row.get("serial") != serial
                    or not isinstance(row.get("id"), str)
                    or not _ID.fullmatch(row["id"])
                    or not isinstance(row.get("start"), str)
                    or not isinstance(row.get("end"), str)):
                raise ValueError("Invalid recording metadata")
            rows.append({
                "entity_id": msg["entity_id"], "id": row["id"],
                "start": row["start"], "end": row["end"],
                "thumbnail": row.get("thumbnail") is True,
            })
        # Check permission again after potentially slow bridge request.
        _camera(hass, connection, msg["entity_id"])
        connection.send_result(msg["id"], {"complete": True, "recordings": rows})
    except Exception as exc:
        _error(connection, msg, exc)


@websocket_api.websocket_command({
    vol.Required("type"): "eufy_viewer/launcher_thumbnail",
    vol.Required("entity_id"): vol.Match(_ENTITY.pattern),
    vol.Required("recording_id"): vol.Match(_ID.pattern),
})
@websocket_api.async_response
async def launcher_thumbnail(hass, connection, msg):
    try:
        coordinator, serial = _camera(hass, connection, msg["entity_id"])
        async with asyncio.timeout(30):
            jpeg = await coordinator.api.recording_thumbnail(
                serial, msg["recording_id"]
            )
        if (not isinstance(jpeg, bytes) or len(jpeg) > _MAX_JPEG
                or len(jpeg) < 4 or not jpeg.startswith(b"\xff\xd8")):
            raise ValueError("Invalid or excessive thumbnail")
        _camera(hass, connection, msg["entity_id"])
        connection.send_result(msg["id"], {
            "content_type": "image/jpeg",
            "jpeg": base64.b64encode(jpeg).decode("ascii"),
        })
    except Exception as exc:
        _error(connection, msg, exc)


def async_register_recording_commands(hass) -> None:
    websocket_api.async_register_command(hass, launcher_events)
    websocket_api.async_register_command(hass, launcher_thumbnail)
