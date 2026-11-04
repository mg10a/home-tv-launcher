"""Drive notifications for the existing private photo sync; no folder polling."""
import asyncio
from datetime import timedelta
import hmac
import logging
from pathlib import Path
import secrets
import time
import uuid
from aiohttp import web
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import AuthorizedSession
from homeassistant.components import cloud, webhook
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store

DOMAIN = "halo_photo_push"
LOG = logging.getLogger(__name__)
API = "https://www.googleapis.com/drive/v3/"

async def async_setup_entry(hass, entry):
    worker = Worker(hass, entry)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = worker
    await worker.setup()
    entry.async_on_unload(worker.cancel)
    return True

async def async_unload_entry(hass, entry):
    worker = hass.data[DOMAIN].pop(entry.entry_id)
    worker.cancel()
    webhook.async_unregister(hass, worker.state["hook"])
    return True

class Worker:
    def __init__(self, hass, entry):
        self.hass, self.entry = hass, entry
        self.store = Store(hass, 1, DOMAIN)
        self.state = {}
        self.lock = asyncio.Lock()
        self.task = None
        self.unsub = None
        self.session = None
        self.closed = False

    async def setup(self):
        self.state = await self.store.async_load() or {"hook": secrets.token_hex(32), "secret": secrets.token_hex(32), "channels": [], "pending": True}
        await self.store.async_save(self.state)
        webhook.async_register(self.hass, DOMAIN, "Halo Drive uploads", self.state["hook"], self.receive, local_only=False, allowed_methods=["POST"])
        self.unsub = async_track_time_interval(self.hass, self.maintenance, timedelta(hours=12))
        self.task = self.hass.async_create_task(self.run())

    def cancel(self):
        self.closed = True
        if self.unsub:
            self.unsub()
        if self.task:
            self.task.cancel()

    def api(self, method, path, **kwargs):
        if self.session is None:
            p = Path(self.entry.data["credential_file"]).resolve()
            root = Path(self.hass.config.config_dir).resolve()
            if not p.is_relative_to(root) or p.suffix != ".json":
                raise ValueError("Credential file must be inside the Home Assistant configuration folder")
            creds = Credentials.from_service_account_file(str(p), scopes=["https://www.googleapis.com/auth/drive.readonly"])
            self.session = AuthorizedSession(creds)
        response = self.session.request(method, API + path, timeout=30, **kwargs)
        response.raise_for_status()
        return response.json() if response.content else {}

    async def call(self, method, path, **kwargs):
        return await self.hass.async_add_executor_job(lambda: self.api(method, path, **kwargs))

    async def receive(self, hass, hook, request):
        headers = request.headers
        if not hmac.compare_digest(headers.get("X-Goog-Channel-Token", ""), self.state["secret"]):
            return web.Response(status=200)
        channel = next((c for c in self.state["channels"] if c["id"] == headers.get("X-Goog-Channel-Id")), None)
        if not channel or (channel.get("resourceId") and channel["resourceId"] != headers.get("X-Goog-Resource-Id")):
            return web.Response(status=200)
        self.state["last_notification"] = time.time()
        if headers.get("X-Goog-Resource-State") != "sync":
            self.state["pending"] = True
        await self.store.async_save(self.state)
        if not self.task or self.task.done():
            self.task = self.hass.async_create_task(self.run(delay=30))
        return web.Response(status=200)

    async def maintenance(self, now):
        # Checks local expiry only; no Drive request until renewal is due.
        if self.state.get("expires", 0) - time.time() < 86400 or self.state.get("pending"):
            if not self.task or self.task.done():
                self.task = self.hass.async_create_task(self.run())

    async def renew(self):
        if self.state.get("expires", 0) - time.time() > 86400:
            return False
        if "url" not in self.state:
            self.state["url"] = await cloud.async_create_cloudhook(self.hass, self.state["hook"])
        if "page" not in self.state:
            data = await self.call("GET", "changes/startPageToken")
            self.state["page"] = data["startPageToken"]
        channel = {"id": str(uuid.uuid4()), "expires": time.time() + 6 * 86400}
        self.state["channels"] = [c for c in self.state["channels"] if c["expires"] > time.time()] + [channel]
        await self.store.async_save(self.state)
        data = await self.call("POST", "changes/watch", params={"pageToken": self.state["page"], "restrictToMyDrive": "false"}, json={"id": channel["id"], "type": "web_hook", "address": self.state["url"], "token": self.state["secret"], "expiration": str(int(channel["expires"] * 1000))})
        channel["resourceId"] = data["resourceId"]
        channel["expires"] = int(data["expiration"]) / 1000
        self.state["expires"] = channel["expires"]
        await self.store.async_save(self.state)
        return True

    async def changes(self):
        page = self.state["page"]
        relevant = not self.state.get("initial_sync")
        while True:
            data = await self.call("GET", "changes", params={"pageToken": page, "restrictToMyDrive": "false", "fields": "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,parents,trashed,mimeType,name))", "pageSize": 1000})
            for change in data.get("changes", []):
                file = change.get("file", {})
                if self.entry.data["folder_id"] in file.get("parents", []) and not file.get("trashed"):
                    relevant = True
            if "nextPageToken" not in data:
                return data.get("newStartPageToken", page), relevant
            page = data["nextPageToken"]

    async def run(self, delay=0):
        await asyncio.sleep(delay)
        async with self.lock:
            for attempt in range(5):
                try:
                    renewed = await self.renew()
                    if renewed or self.state.get("pending"):
                        self.state["pending"] = False
                        page, relevant = await self.changes()
                        if relevant:
                            await self.hass.services.async_call("script", "refresh_dashboard_photos", {}, blocking=True)
                        self.state["page"] = page
                        self.state["initial_sync"] = True
                        self.state["last_success"] = time.time()
                        await self.store.async_save(self.state)
                    self.hass.states.async_set("sensor.halo_photo_uploads", "listening", {"friendly_name": "Halo photo uploads", "subscription_expires": self.state.get("expires"), "last_notification": self.state.get("last_notification"), "last_success": self.state.get("last_success"), "folder_polling": False})
                    if not self.state.get("pending"):
                        return
                except Exception as error:
                    self.state["pending"] = True
                    await self.store.async_save(self.state)
                    # Do not log request URLs, credentials, or channel tokens.
                    LOG.warning("Photo notification setup/sync failed (%s); retrying", type(error).__name__)
                    self.hass.states.async_set("sensor.halo_photo_uploads", "retrying", {"friendly_name": "Halo photo uploads", "error_type": type(error).__name__, "folder_polling": False})
                await asyncio.sleep(min(60 * (attempt + 1), 300))
