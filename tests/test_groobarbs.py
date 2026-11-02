import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('groo',Path(__file__).parents[1]/'custom_components/groobarbs/client.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def fixture(self):
  return {'editable':True,'items':[{'id':1,'contents_can_change':True,'max_swaps':4,'swap_count':3,'contents':[{'id':2,'product_id':3,'replaced_product_id':None,'category_ids':[5]}]}],'replacements':[{'id':4,'category_ids':[5]}]}
 def test_allowed(self): m.validate_swap(self.fixture(),1,2,4)
 def test_closed(self):
  p=self.fixture();p['editable']=False
  with self.assertRaises(m.GroobarbsError):m.validate_swap(p,1,2,4)
 def test_limit(self):
  p=self.fixture();p['items'][0]['swap_count']=4
  with self.assertRaises(m.GroobarbsError):m.validate_swap(p,1,2,4)
 def test_category(self):
  p=self.fixture();p['replacements'][0]['category_ids']=[6]
  with self.assertRaises(m.GroobarbsError):m.validate_swap(p,1,2,4)
 def test_private_fields_removed(self):
  p=m.public_preview({'props':{'auth':{'email':'private'},'deliveryPreview':{'order':{'delivery_address':'private','notes':'private','items':[]}}}})
  self.assertNotIn('private',str(p))
 def test_html(self):
  parser=m.PageParser();parser.feed('<div id="app" data-page="{&quot;component&quot;:&quot;My/Dashboard&quot;}"></div>')
  self.assertEqual(parser.page['component'],'My/Dashboard')
if __name__=='__main__':unittest.main()
