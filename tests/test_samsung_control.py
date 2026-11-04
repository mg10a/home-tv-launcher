import asyncio
import datetime as dt
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'samsung_food_bridge'))
import control

class SettingsTests(unittest.TestCase):
    def test_sunday_boundary(self):
        settings = control.DEFAULT_RESET
        self.assertFalse(control.reset_due(settings, None, dt.datetime(2026, 11, 8, 12, 59, tzinfo=dt.timezone.utc)))
        self.assertTrue(control.reset_due(settings, None, dt.datetime(2026, 11, 8, 13, 0, tzinfo=dt.timezone.utc)))
        self.assertFalse(control.reset_due(settings, '2026-11-02', dt.datetime(2026, 11, 8, 14, 0, tzinfo=dt.timezone.utc)))

    def test_uk_summer_time(self):
        self.assertFalse(control.reset_due(control.DEFAULT_RESET, None, dt.datetime(2026, 7, 5, 11, 59, tzinfo=dt.timezone.utc)))
        self.assertTrue(control.reset_due(control.DEFAULT_RESET, None, dt.datetime(2026, 7, 5, 12, 0, tzinfo=dt.timezone.utc)))

    def test_disabled_schedule(self):
        self.assertFalse(control.reset_due({**control.DEFAULT_RESET, 'enabled': False}, None, dt.datetime(2026, 11, 8, 14, tzinfo=dt.timezone.utc)))

    def test_invalid_schedule(self):
        for change in ({'weekday': 7}, {'weekday': True}, {'time': '25:00'}, {'time': '13:99'}, {'enabled': 'yes'}):
            with self.assertRaises(ValueError):
                control.reset_settings({**control.DEFAULT_RESET, **change})

class CommandTests(unittest.TestCase):
    def command(self):
        start = control.monday(dt.datetime.now(control.TZ).date()).isoformat()
        return {'id': 'test-command-123', 'created': 1000, 'action': 'add_meal', 'week': start,
                'date': start, 'revision': 'a'*24, 'recipe_id': '1011234567890', 'slot': 'Dinner'}

    def test_valid_command(self):
        self.assertEqual(control.validate_command(self.command(), 1000)['action'], 'add_meal')

    def test_stale_unknown_and_out_of_week_are_rejected(self):
        for change in ({'created': 1}, {'action': 'exec'}, {'recipe_id': '../bad'}, {'slot': 'bad'},
                       {'date': '2000-01-01'}, {'revision': ''}, {'id': 'bad'}):
            with self.assertRaises((ValueError, TypeError)):
                control.validate_command({**self.command(), **change}, 1000)

    def test_revision_changes_with_meals(self):
        self.assertNotEqual(control.revision([{'meals': []}]), control.revision([{'meals': [{'title': 'Soup'}]}]))

class WriteSafetyTests(unittest.IsolatedAsyncioTestCase):
    async def test_repeat_generation_does_not_click_again(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(control, 'DATA', Path(directory)):
            c = control.Controller(None, {})
            c.state['generated']['2026-11-02:abc'] = {'url': 'https://app.samsungfood.com/shopping-list/test'}
            async def read(): pass
            c.read_shopping = read
            await c.generate({'week': '2026-11-02', 'revision': 'abc'})
            self.assertTrue(c.shopping['source_url'].endswith('/test'))

    async def test_uncertain_generation_is_not_replayed(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(control, 'DATA', Path(directory)):
            c = control.Controller(None, {})
            c.state['generated']['2026-11-02:abc'] = {'status': 'creating'}
            with self.assertRaises(RuntimeError):
                await c.generate({'week': '2026-11-02', 'revision': 'abc'})

    async def test_changed_week_prevents_clear(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(control, 'DATA', Path(directory)):
            c = control.Controller(None, {})
            c.state['commands']['test'] = {'status': 'queued'}
            async def noop(): pass
            async def read(week): return {'revision': 'new'}
            async def must_not_clear(*args): self.fail('stale snapshot reached clear')
            c.publish = noop
            c.ensure_login = noop
            c.read_week = read
            c.clear = must_not_clear
            await c.command({'id': 'test', 'action': 'clear_week', 'week': '2026-11-02', 'revision': 'old'})
            self.assertEqual(c.state['commands']['test']['status'], 'uncertain')

    async def test_interrupted_commands_become_uncertain(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(control, 'DATA', Path(directory)):
            control.save('control', {'commands': {'test': {'status': 'running'}}})
            c = control.Controller(None, {})
            self.assertEqual(c.state['commands']['test']['status'], 'uncertain')

if __name__ == '__main__': unittest.main()
