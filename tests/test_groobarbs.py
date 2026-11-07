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
class MutationTests(unittest.IsolatedAsyncioTestCase):
 async def test_stale_snapshot_never_posts(self):
  client=object.__new__(m.Client)
  async def read(): return {'order_id':9,'editable':False}
  async def request(*args,**kwargs): self.fail('Must not write a stale box')
  client.read=read;client.request=request
  with self.assertRaises(m.GroobarbsError):await client.swap(9,1,2,4,{})
 async def test_timeout_is_not_retried(self):
  client=object.__new__(m.Client);p=Tests().fixture();p['order_id']=9;posts=[]
  async def read():return p
  async def request(*args,**kwargs):posts.append(args);raise TimeoutError()
  client.read=read;client.request=request
  with self.assertRaises(TimeoutError):await client.swap(9,1,2,4,p)
  self.assertEqual(len(posts),1)

 def reset_fixture(self, *, editable=True, original=3, returned=3):
  current=Tests().fixture()
  current.update(order_id=9,editable=editable)
  current['items'][0]['contents'][0].update(product_id=4,replaced_product_id=original)
  response={'props':{'deliveryPreview':{'order':{
   'id':9,'items':[{'id':1,'swap_count':2,'contents':[
    {'id':2,'product_id':returned,'replaced_product_id':None}]}]
  }}}}
  calls=[]
  client=object.__new__(m.Client)
  async def read(): return current
  async def request(*args):
   calls.append(args)
   return response
  client.read=read
  client.request=request
  return client,current,calls

 async def test_restore_uses_delete_and_verifies_returned_product(self):
  client,current,calls=self.reset_fixture()
  result=await client.reset(9,1,2,current)
  self.assertEqual(calls,[('DELETE','/orders/9/items/1/content/2/swap')])
  self.assertEqual(result['items'][0]['contents'][0]['product_id'],3)
  self.assertEqual(result['items'][0]['swap_count'],2)

 async def test_restore_rejects_closed_or_unchanged_items_without_writing(self):
  for options in ({'editable':False},{'original':None}):
   client,current,calls=self.reset_fixture(**options)
   with self.assertRaises(m.GroobarbsError):await client.reset(9,1,2,current)
   self.assertEqual(calls,[])

 async def test_restore_rejects_stale_review_without_writing(self):
  client,_,calls=self.reset_fixture()
  with self.assertRaises(m.GroobarbsError):await client.reset(9,1,2,{})
  self.assertEqual(calls,[])

 async def test_restore_does_not_repeat_an_uncertain_change(self):
  client,current,calls=self.reset_fixture(returned=4)
  with self.assertRaisesRegex(m.GroobarbsError,'Result uncertain'):await client.reset(9,1,2,current)
  self.assertEqual(len(calls),1)

if __name__=='__main__':unittest.main()
