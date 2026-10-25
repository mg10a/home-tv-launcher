"""Pure regression tests that run without Home Assistant installed."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import unittest

IDENTITY = Path(__file__).resolve().parents[1] / "custom_components/eufy_viewer/identity.py"
spec = spec_from_file_location("eufy_identity", IDENTITY)
module = module_from_spec(spec)
spec.loader.exec_module(module)

class EufyDualHubIdentityTests(unittest.TestCase):
    def test_original_camera_entity_and_device_never_change(self):
        original_bridge = "6aa9197d-bbf4-48fa-8c41-b2e4ac0b998e"
        physical_serial = "T8213_CAMERA_SERIAL"
        self.assertEqual(module.device_key(original_bridge, physical_serial), physical_serial)
        self.assertEqual(module.entity_key(original_bridge, physical_serial, "camera"),
                         physical_serial + "_camera")
        self.assertEqual(module.camera_serial(original_bridge, physical_serial + "_camera"),
                         physical_serial)

    def test_dev_camera_and_device_are_separate(self):
        original_bridge = "6aa9197d-bbf4-48fa-8c41-b2e4ac0b998e"
        dev_bridge = "home-tv-dev-" + original_bridge
        serial = "T8213_CAMERA_SERIAL"
        original = module.entity_key(original_bridge, serial, "camera")
        dev = module.entity_key(dev_bridge, serial, "camera")
        self.assertNotEqual(original, dev)
        self.assertNotEqual(module.device_key(original_bridge, serial),
                            module.device_key(dev_bridge, serial))
        self.assertEqual(module.camera_serial(dev_bridge, dev), serial)
        self.assertIsNone(module.camera_serial(dev_bridge, original))

    def test_all_other_entity_types_namespaced_for_dev_only(self):
        original = "3a9462e0-bda1-4c10-b749-83aa1fac7b08"
        dev = "home-tv-dev-" + original
        for kind in ("battery", "event", "refresh_snapshot", "guard_mode", "alarm"):
            with self.subTest(kind=kind):
                self.assertEqual(module.entity_key(original, "physical", kind), "physical_" + kind)
                self.assertEqual(module.entity_key(dev, "physical", kind),
                                 dev + ":physical_" + kind)

    def test_camera_validation(self):
        dev = "home-tv-dev-some-id"
        self.assertIsNone(module.camera_serial(dev, "not_a_camera"))
        self.assertIsNone(module.camera_serial(dev, dev + ":_camera"))
        self.assertIsNone(module.camera_serial(dev, "unrelated:physical_camera"))
        self.assertIsNone(module.camera_serial(dev, "physical_camera"))
        self.assertIsNone(module.camera_serial(dev, None))
        self.assertEqual(module.camera_serial(dev, dev + ":T8213_camera"), "T8213")


if __name__ == "__main__":
    unittest.main()
