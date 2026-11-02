"""Unofficial Groobarbs Inertia client; derived from public frontend, 2026-11-02."""
import json
from html.parser import HTMLParser
from urllib.parse import unquote
import aiohttp

BASE = 'https://my.groobarbs.co.uk'

class GroobarbsError(Exception):
    """Sanitized error; never include account responses or credentials."""

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.page = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id') == 'app' and 'data-page' in attrs:
            self.page = json.loads(attrs['data-page'])


def public_preview(page):
    """Allowlist fields, excluding account identity, addresses, notes and payment data."""
    props = page.get('props', {})
    preview = props.get('deliveryPreview') or {}
    run = preview.get('order_run') or {}
    order = preview.get('order') or {}
    items = []
    for item in order.get('items', []):
        safe = {k: item.get(k) for k in ('id','title','qty','total','contents_can_change','max_swaps','swap_count','bespoke')}
        safe['contents'] = [{k:c.get(k) for k in ('id','title','product_id','replaced_product_id','replaced_title','category_ids')} for c in item.get('contents', [])]
        items.append(safe)
    return {'date':preview.get('date'), 'type':preview.get('type'), 'order_id':order.get('id'),
            'editable':run.get('is_editable') is True,'deadline':run.get('close_to_customers_at'),
            'total':order.get('total'),'items':items,
            'replacements':[{k:r.get(k) for k in ('id','title','category_ids')} for r in run.get('replacements',[])]}


def validate_swap(preview, item_id, content_id, replacement_id):
    if not preview['editable']: raise GroobarbsError('Delivery changes are closed')
    item = next((i for i in preview['items'] if i['id'] == item_id), None)
    if not item or not item['contents_can_change']: raise GroobarbsError('Box cannot be changed')
    content = next((c for c in item['contents'] if c['id'] == content_id), None)
    if not content: raise GroobarbsError('Content is no longer in the box')
    if not content['replaced_product_id'] and item['max_swaps'] and item['swap_count'] >= item['max_swaps']:
        raise GroobarbsError('Swap allowance exhausted')
    replacement = next((r for r in preview['replacements'] if r['id'] == replacement_id), None)
    excluded = content['replaced_product_id'] or content['product_id']
    if not replacement or replacement_id == excluded or not set(replacement['category_ids'] or []) & set(content['category_ids'] or []):
        raise GroobarbsError('Replacement is not available for this item')


class Client:
    def __init__(self, email, password):
        self.email, self.password = email, password
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=25))
    async def close(self): await self.session.close()
    async def request(self, method, path, data=None):
        headers = {'Accept':'text/html, application/xhtml+xml','Referer':BASE+'/', 'Origin':BASE}
        for cookie in self.session.cookie_jar:
            if cookie.key == 'XSRF-TOKEN': headers['X-XSRF-TOKEN'] = unquote(cookie.value)
        # Do not follow redirects with credentials or replay a mutation on failures.
        async with self.session.request(method, BASE+path, json=data, headers=headers, allow_redirects=False) as response:
            if response.status in (301,302,303):
                location=response.headers.get('Location','')
                if location in ('/', BASE+'/'): return await self.request('GET','/')
                raise GroobarbsError('Sign-in required or request rejected')
            if response.status != 200: raise GroobarbsError('Groobarbs request failed; refresh before retrying')
            parser=PageParser(); parser.feed(await response.text())
            if not parser.page: raise GroobarbsError('Website format changed')
            if parser.page.get('props',{}).get('errors'): raise GroobarbsError('Groobarbs rejected the request')
            return parser.page
    async def login(self):
        await self.request('GET','/login')
        page=await self.request('POST','/login',{'email':self.email,'password':self.password,'remember':False})
        if page.get('component') != 'My/Dashboard': raise GroobarbsError('Sign-in was not completed')
    async def read(self):
        page=await self.request('GET','/')
        if page.get('component') != 'My/Dashboard': raise GroobarbsError('Sign-in required')
        return public_preview(page)
    async def swap(self, order_id, item_id, content_id, replacement_id, expected):
        current=await self.read()
        if current != expected or current['order_id'] != order_id: raise GroobarbsError('Box changed; refresh and review again')
        validate_swap(current,item_id,content_id,replacement_id)
        # IDs are integers only; callers cannot supply arbitrary paths.
        if any(type(i) is not int or i < 1 for i in (order_id,item_id,content_id,replacement_id)): raise GroobarbsError('Invalid identifier')
        page=await self.request('POST',f'/orders/{order_id}/items/{item_id}/content/{content_id}/swap',{'replacement_id':replacement_id})
        updated=public_preview(page)
        item=next((i for i in updated['items'] if i['id']==item_id),{})
        content=next((c for c in item.get('contents',[]) if c['id']==content_id),{})
        if content.get('product_id') != replacement_id: raise GroobarbsError('Result uncertain; refresh before trying again')
        return updated
