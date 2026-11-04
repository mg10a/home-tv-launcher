import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('bridge',Path(__file__).parents[1]/'samsung_food_bridge/bridge.py')
bridge=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

class Validate(unittest.TestCase):
    def week(self):
        return [{'date':f'2026-11-{day:02}', 'meals':[]} for day in range(2,9)]
    def test_valid_empty_week(self):
        self.assertEqual(bridge.validate(self.week()),self.week())
    def test_valid_meal(self):
        week=self.week();week[2]['meals']=[{'title':'Test meal','slot':'Dinner'}]
        self.assertEqual(bridge.validate(week)[2]['date'],'2026-11-04')
    def test_duplicate_day_rejected(self):
        week=self.week();week[2]=week[1]
        with self.assertRaises(ValueError):bridge.validate(week)
    def test_incomplete_or_invalid_date_rejected(self):
        with self.assertRaises(ValueError):bridge.validate(self.week()[:6])
        week=self.week();week[0]['date']='2026-02-30'
        with self.assertRaises(ValueError):bridge.validate(week)
    def test_unknown_card_rejected(self):
        week=self.week();week[1]['meals']=[{'title':'Notes'}]
        with self.assertRaises(ValueError):bridge.validate(week)

if __name__=='__main__':unittest.main()
