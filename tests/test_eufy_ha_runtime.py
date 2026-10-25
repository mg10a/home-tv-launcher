"""Integration smoke tests with the actual Home Assistant 2026.10 runtime.

No camera login, tokens, or bridge connections are required. We validate
actual entity instances, registry-key separation, and still-real serials.
"""
from __future__ import annotations

from types import SimpleNamespace
import unittest

from custom_components.eufy_viewer.camera import EufyCamera
from custom_components.eufy_viewer.identity import camera_serial, device_key, entity_key


class CameraRegistrySmokeTests(unittest.TestCase):
    def _camera(self, bridge_id: str):
        info = SimpleNamespace(
            serial="T8213_TEST_CAMERA", name="Doorbell", model="T8213",
            hardware="1.0", software="0.2.1.8",
            snapshot_received_at=None, capabilities={}, battery=None,
        )
        coordinator = SimpleNamespace(
            data=SimpleNamespace(cameras={info.serial: info}, webrtc=True),
            entry=SimpleNamespace(unique_id=bridge_id),
            is_dev_bridge=bridge_id.startswith("home-tv-dev-"),
            device_key=lambda serial: device_key(bridge_id, serial),
            entity_key=lambda serial, kind: entity_key(bridge_id, serial, kind),
        )
        return EufyCamera(coordinator, info)

    def test_production_camera_retains_existing_registry_identity(self):
        camera = self._camera("ccccaaa1-1111-4444-8888-0123456789ab")
        self.assertEqual(camera.unique_id, "T8213_TEST_CAMERA_camera")
        self.assertEqual(camera.device_info["identifiers"], {
            ("eufy_viewer", "T8213_TEST_CAMERA")
        })
        self.assertEqual(camera.device_info["name"], "Doorbell")

    def test_dev_camera_has_distinct_entity_and_device_registry_identity(self):
        original = "ccccaaa1-1111-4444-8888-0123456789ab"
        dev = "home-tv-dev-" + original
        camera = self._camera(dev)
        self.assertEqual(camera.unique_id, dev + ":T8213_TEST_CAMERA_camera")
        self.assertEqual(camera.device_info["identifiers"], {
            ("eufy_viewer", dev + ":T8213_TEST_CAMERA")
        })
        self.assertEqual(camera.device_info["name"], "Doorbell DEV")
        self.assertEqual(camera_serial(dev, camera.unique_id), "T8213_TEST_CAMERA")
        self.assertTrue(camera.extra_state_attributes["viewer_dev_bridge"])
        self.assertTrue(camera.extra_state_attributes["viewer_card"])


if __name__ == "__main__":
    unittest.main()
