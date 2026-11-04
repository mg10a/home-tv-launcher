"""Private, serialized UI writes. Commands arrive only via authenticated HA events."""
import asyncio
import datetime as dt
import hashlib
import json
import os
import re
import time
from pathlib import Path
from zoneinfo import ZoneInfo

from bridge import DATA, ORIGIN, ENTITY, SHOPPING_ENTITY, login, publish_state, validate, validate_shopping

DAY = '488a6f56-583c-ee62-d353-df8debed9e3f'
CARD = '40c2d572-ab58-99ea-b8a6-173d9155b935'
MENU = '62e11625b-fe42-62be-5ca2-1de8d0265c4e'
PLUS = '62a0f009-18be-1920-0ad2-c39bcce386b8'
RECIPE_CARD = '3b3f878f-c796-f5b8-3c50-18a2d2269696'
CONTROL = 'sensor.samsung_food_control'
RECIPES = 'sensor.samsung_food_saved_recipes'
TZ = ZoneInfo('Europe/London')
DEFAULT_RESET = {'enabled': True, 'weekday': 6, 'time': '13:00'}

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def monday(day):
    return day - dt.timedelta(days=day.weekday())

def revision(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:24]

def save(name, value):
    target = DATA / (name + '.json')
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.replace(target)

def load(name, default):
    try:
        return json.loads((DATA / (name + '.json')).read_text())
    except (OSError, ValueError):
        return default

async def emit(entity, status, attributes):
    try:
        await asyncio.to_thread(publish_state, entity, status, attributes)
    except Exception:
        print('Samsung Food state publication: retrying on next heartbeat', flush=True)

def reset_settings(value):
    if not isinstance(value, dict) or type(value.get('enabled')) is not bool:
        raise ValueError('Invalid reset setting')
    if type(value.get('weekday')) is not int or not 0 <= value['weekday'] <= 6:
        raise ValueError('Invalid reset day')
    if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', str(value.get('time', ''))):
        raise ValueError('Invalid reset time')
    return {k: value[k] for k in ('enabled', 'weekday', 'time')}

def reset_due(settings, last, current):
    local = current.astimezone(TZ)
    start = monday(local.date())
    hour, minute = map(int, settings['time'].split(':'))
    due = dt.datetime.combine(start + dt.timedelta(days=settings['weekday']), dt.time(hour, minute), TZ)
    return settings['enabled'] and local >= due and last != start.isoformat()

def validate_command(value, current=None):
    if not isinstance(value, dict):
        raise ValueError('Invalid command')
    if not re.fullmatch(r'[a-zA-Z0-9-]{12,80}', str(value.get('id', ''))):
        raise ValueError('Invalid command ID')
    if value.get('action') not in ('refresh', 'add_meal', 'clear_day', 'clear_week', 'generate', 'settings'):
        raise ValueError('Unknown action')
    if type(value.get('created')) not in (int, float) or abs((current or time.time()) - value['created']) > 120:
        raise ValueError('Expired command')
    if value['action'] == 'settings':
        reset_settings(value.get('settings'))
    elif value['action'] != 'refresh':
        week = dt.date.fromisoformat(value.get('week', ''))
        if week.weekday() or abs((week - monday(dt.datetime.now(TZ).date())).days) > 14:
            raise ValueError('Week is outside the editable range')
        if not re.fullmatch(r'[a-f0-9]{24}', str(value.get('revision', ''))):
            raise ValueError('Refresh this week before editing')
        if value['action'] in ('add_meal', 'clear_day'):
            day = dt.date.fromisoformat(value.get('date', ''))
            if not 0 <= (day - week).days <= 6:
                raise ValueError('Day is outside this week')
        if value['action'] == 'add_meal':
            if not re.fullmatch(r'[a-zA-Z0-9-]{10,100}', str(value.get('recipe_id', ''))):
                raise ValueError('Invalid saved recipe')
            if value.get('slot') not in ('Breakfast', 'Lunch', 'Dinner', 'Snacks'):
                raise ValueError('Invalid meal type')
    return value

# Only rendered recipe-card information; never page internals or access tokens.
EXTRACT_RECIPES = r'''() => [...document.querySelectorAll('[data-testid="3b3f878f-c796-f5b8-3c50-18a2d2269696"]')].map(c=>{
 const a=[...c.querySelectorAll('a')].find(a=>a.querySelector('p'));
 const href=a?.getAttribute('href')||'';
 const id=href.match(/^\/recipes\/([a-zA-Z0-9-]+)/)?.[1]||'';
 const image=[...c.querySelectorAll('img')].map(i=>i.getAttribute('src')||'').find(s=>/h_264|w_208/.test(s))||'';
 return {id,title:a?.querySelector('p')?.textContent?.trim()||'',image:image.split('/recipe/').pop().split('?')[0]};
}).filter(r=>r.title)'''

class Controller:
    def __init__(self, page, options):
        self.page, self.options = page, options
        self.state = load('control', {})
        self.state.setdefault('settings', DEFAULT_RESET.copy())
        self.state.setdefault('commands', {})
        self.state.setdefault('generated', {})
        self.state.setdefault('archives', [])
        self.weeks = load('weeks', {})
        self.recipes = load('recipes', [])
        self.shopping = load('last-shopping-success', {})
        self.queue = asyncio.Queue(maxsize=12)
        self.connected = False
        self.last_login = 0
        self.login_failures = 0
        self.sync_status = 'starting'
        self.stage = 'starting'
        # Never replay an uncertain write after a process interruption.
        for result in self.state['commands'].values():
            if result['status'] in ('running', 'queued'):
                result.update(status='uncertain', message='Interrupted. Check Samsung Food before trying again.')

    async def publish(self):
        self.state['commands'] = dict(list(self.state['commands'].items())[-30:])
        save('control', self.state)
        await emit(CONTROL, self.sync_status, {
            'friendly_name': 'Samsung Food controls', 'version': '0.3.0',
            'commands_connected': self.connected, 'stage': self.stage, 'settings': self.state['settings'],
            'last_reset': self.state.get('last_reset'), 'last_success': self.state.get('last_success'),
            'results': self.state['commands'], 'generated': self.state['generated'],
            'reset_error': self.state.get('reset_error', ''), 'read_only': False})
        start = monday(dt.datetime.now(TZ).date()).isoformat()
        current = self.weeks.get(start, {})
        await emit(ENTITY, self.sync_status, {
            'friendly_name': 'Samsung Food meal plan', 'days': current.get('days', []),
            'weeks': self.weeks, 'last_success': current.get('last_success'),
            'sync_status': self.sync_status, 'read_only': False, 'source_url': ORIGIN + '/meal-plan'})
        await emit(RECIPES, str(len(self.recipes)), {
            'friendly_name': 'Samsung Food saved recipes', 'recipes': self.recipes,
            'last_success': self.state.get('recipes_success')})
        if self.shopping:
            await emit(SHOPPING_ENTITY, self.shopping.get('sync_status', 'ok'), {
                **self.shopping, 'friendly_name': 'Samsung Food shopping list', 'read_only': True})

    async def ensure_login(self):
        await self.page.goto(ORIGIN + '/meal-plan', wait_until='domcontentloaded')
        signed = self.page.get_by_test_id(DAY).first.or_(self.page.get_by_role('button', name='Start from scratch', exact=True))
        button = self.page.get_by_role('button', name='Log in', exact=True)
        await signed.or_(button.first).wait_for(timeout=30000)
        if await button.count():
            cooldown = min(3600, 300 * 2 ** min(self.login_failures, 4))
            if time.time() - self.last_login < cooldown:
                raise RuntimeError('Sign-in needs attention; retry is cooling down')
            self.last_login = time.time()
            try:
                await login(self.page, self.options)
                self.login_failures = 0
            except Exception:
                self.login_failures += 1
                self.sync_status = 'login_required'
                raise RuntimeError('Samsung Food sign-in needs attention') from None
        await signed.wait_for()

    async def read_week(self, week):
        self.stage = 'reading_week'
        await self.page.goto(ORIGIN + '/meal-plan', wait_until='domcontentloaded')
        for _ in range(5):
            blank = self.page.get_by_role('button', name='Start from scratch', exact=True)
            await self.page.get_by_test_id(DAY).nth(6).or_(blank).wait_for()
            if await blank.count():
                await blank.click()
                await self.page.get_by_test_id(DAY).nth(6).wait_for()
            await self.page.wait_for_timeout(1000)
            days = validate(await self.page.evaluate(Path('/app/extract.js').read_text()))
            first = days[0]['date']
            if first == week:
                result = {'days': days, 'revision': revision(days), 'last_success': now()}
                self.weeks[week] = result
                return result
            target = dt.date.fromisoformat(week)
            calendar = self.page.get_by_test_id('4068ce33-f97a-d7f3-c8d1-3da012463028')
            for _ in range(4):
                text = await calendar.inner_text()
                match = re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2})\b', text)
                if not match:
                    raise RuntimeError('Calendar month could not be identified')
                month = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split().index(match[1]) + 1
                shown = (2000 + int(match[2]), month)
                if shown == (target.year, target.month):
                    break
                tid = '4b43a455-7891-c564-6c0e-852621ee7c3a' if shown < (target.year, target.month) else 'eb3dbf5d-5db9-491f-1ada-982cad2a7357'
                await calendar.get_by_test_id(tid).click()
                await self.page.wait_for_timeout(500)
            else:
                raise RuntimeError('Calendar month is outside the supported range')
            cell_index = target.replace(day=1).weekday() + target.day - 1
            cell = calendar.get_by_test_id('663e0a55-8709-5549-6e93-61e754bd9752').nth(cell_index)
            if (await cell.inner_text()).strip() != str(target.day):
                raise RuntimeError('Calendar day could not be verified')
            await cell.click()
        raise RuntimeError('Week could not be loaded')

    async def read_recipes(self):
        self.stage = 'reading_saved_recipes'
        await self.page.goto(ORIGIN + '/recipe-box', wait_until='domcontentloaded')
        await self.page.get_by_role('heading', name='Saved', exact=True).wait_for()
        await self.page.wait_for_timeout(2000)
        recipes = await self.page.evaluate(EXTRACT_RECIPES)
        for _ in range(20):
            cards = self.page.get_by_test_id(RECIPE_CARD)
            if not await cards.count():
                break
            await cards.last.scroll_into_view_if_needed()
            await self.page.wait_for_timeout(700)
            fresh = await self.page.evaluate(EXTRACT_RECIPES)
            if len(fresh) == len(recipes):
                break
            recipes = fresh
        if not recipes or any(not re.fullmatch(r'[a-zA-Z0-9-]{10,100}', r['id']) for r in recipes):
            raise RuntimeError('Saved recipes are unavailable')
        self.recipes = list({r['id']: r for r in recipes}.values())[:500]
        self.state['recipes_success'] = now()
        save('recipes', self.recipes)

    async def read_shopping(self):
        self.stage = 'reading_shopping'
        await self.page.goto(self.shopping.get('source_url', ORIGIN + '/shopping-list'), wait_until='domcontentloaded')
        await self.page.get_by_role('searchbox', name='Add item', exact=True).wait_for()
        await self.page.wait_for_timeout(1500)
        result = validate_shopping(await self.page.evaluate(Path('/app/extract-shopping.js').read_text()))
        result.update(last_success=now(), sync_status='ok')
        self.shopping = result
        save('last-shopping-success', result)

    async def listen(self):
        from websockets.asyncio.client import connect
        while True:
            try:
                async with connect('ws://supervisor/core/websocket', ping_interval=30, ping_timeout=30, proxy=None) as ws:
                    await ws.recv()
                    await ws.send(json.dumps({'type': 'auth', 'access_token': os.environ['SUPERVISOR_TOKEN']}))
                    if json.loads(await ws.recv()).get('type') != 'auth_ok':
                        raise RuntimeError('HA authentication failed')
                    await ws.send(json.dumps({'id': 1, 'type': 'subscribe_events', 'event_type': 'samsung_food_command'}))
                    if not json.loads(await ws.recv()).get('success'):
                        raise RuntimeError('HA event subscription failed')
                    self.connected = True
                    async for raw in ws:
                        event = json.loads(raw).get('event', {})
                        # Authenticated user commands only, never anonymous integrations.
                        if not event.get('context', {}).get('user_id'):
                            continue
                        try:
                            command = validate_command(event.get('data'))
                            if command['id'] not in self.state['commands']:
                                self.queue.put_nowait(command)
                                self.state['commands'][command['id']] = {'status': 'queued', 'message': 'Waiting for Samsung Food'}
                        except (ValueError, TypeError, asyncio.QueueFull):
                            continue
            except Exception:
                self.connected = False
                print('Samsung Food command connection: retrying', flush=True)
                await asyncio.sleep(15)

    async def clear(self, week, date=None):
        before = await self.read_week(week)
        self.state['archives'] = (self.state['archives'] + [{'week': week, 'date': date, 'saved': now(), 'days': before['days']}])[-20:]
        save('control', self.state)
        for index, day in enumerate(before['days']):
            if date and day['date'] != date:
                continue
            group = self.page.get_by_test_id(DAY).nth(index)
            count = len(day['meals'])
            for _ in range(count):
                cards = group.get_by_test_id(CARD)
                old = await cards.count()
                await cards.first.get_by_test_id(MENU).click()
                await self.page.get_by_role('button', name='Remove from plan', exact=True).click()
                for _ in range(20):
                    if await cards.count() == old - 1:
                        break
                    await self.page.wait_for_timeout(250)
                else:
                    raise RuntimeError('Could not confirm meal removal; check Samsung Food')
        after = await self.read_week(week)
        if any(d['meals'] for d in after['days'] if not date or d['date'] == date):
            raise RuntimeError('Meal clearing was incomplete')

    async def add_meal(self, command):
        recipe = next((r for r in self.recipes if r['id'] == command['recipe_id']), None)
        if not recipe:
            raise RuntimeError('Refresh saved recipes first')
        index = (dt.date.fromisoformat(command['date']) - dt.date.fromisoformat(command['week'])).days
        group = self.page.get_by_test_id(DAY).nth(index)
        before = self.weeks[command['week']]['days'][index]['meals']
        await group.get_by_test_id(PLUS).click()
        await self.page.get_by_role('button', name='Add saved recipe', exact=True).click()
        await self.page.get_by_role('heading', name='Select recipes', exact=True).wait_for()
        await self.page.wait_for_timeout(1200)
        matches = []
        for _ in range(20):
            visible = await self.page.evaluate(EXTRACT_RECIPES)
            matches = [i for i, r in enumerate(visible) if r['title'] == recipe['title'] and r['image'] == recipe['image']]
            if matches:
                break
            cards = self.page.get_by_test_id(RECIPE_CARD)
            if not await cards.count():
                break
            await cards.last.scroll_into_view_if_needed()
            await self.page.wait_for_timeout(700)
        if len(matches) != 1:
            raise RuntimeError('Saved recipe is ambiguous or unavailable; give identical saved copies distinct names')
        await self.page.get_by_test_id(RECIPE_CARD).nth(matches[0]).locator('a').filter(has=self.page.locator('p')).click()
        await self.page.get_by_role('button', name='Add 1 recipe', exact=True).click()
        await self.page.get_by_role('heading', name='Select recipes', exact=True).wait_for(state='hidden')
        await self.page.wait_for_timeout(800)
        cards = group.get_by_test_id(CARD)
        if await cards.count() != len(before) + 1:
            raise RuntimeError('Could not confirm meal addition')
        added = cards.filter(has=self.page.get_by_test_id('97509c46-e691-f136-b754-240e722b3039').filter(has_text=re.compile('^' + re.escape(recipe['title']) + '$'))).last
        slot = await added.get_by_test_id('6022d372-a99e-2a0e-10cd-56e57234be3e').inner_text()
        if slot != command['slot']:
            await added.get_by_test_id(MENU).click()
            await self.page.get_by_role('button', name='Change meal type', exact=True).click()
            await self.page.get_by_role('radio', name=command['slot'], exact=True).check()
            await self.page.get_by_role('button', name='Done', exact=True).click()
            await self.page.get_by_role('heading', name='Meal type', exact=True).wait_for(state='hidden')
        after = await self.read_week(command['week'])
        expected = sorted((m['title'], m['slot']) for m in before) + [(recipe['title'], command['slot'])]
        if sorted((m['title'], m['slot']) for m in after['days'][index]['meals']) != sorted(expected):
            raise RuntimeError('Meal was added but its final type needs checking in Samsung Food')

    async def generate(self, command):
        key = command['week'] + ':' + command['revision']
        existing = self.state['generated'].get(key)
        if existing:
            if existing.get('url'):
                self.shopping['source_url'] = existing['url']
                await self.read_shopping()
                return
            raise RuntimeError('Previous submission is uncertain; check Samsung Food before generating again')
        if not any(d['meals'] for d in self.weeks[command['week']]['days']):
            raise RuntimeError('Choose at least one meal first')
        name = 'Meals ' + command['week'] + ' ' + dt.datetime.now(TZ).strftime('%H%M%S')
        self.state['generated'][key] = {'name': name, 'status': 'creating'}
        save('control', self.state)
        await self.page.get_by_test_id('6f1491f6-5e8a-ea6c-5746-4d6faa6de7b4').click()
        add = self.page.get_by_role('button', name=re.compile(r'^Add \d+ items?$'))
        await add.wait_for()
        await self.page.get_by_role('button', name='Add to Shopping List', exact=True).click()
        await self.page.get_by_role('button', name='Create new list', exact=True).click()
        await self.page.get_by_role('heading', name='Create list', exact=True).wait_for()
        await self.page.get_by_role('textbox').fill(name)
        await self.page.get_by_role('button', name='Create', exact=True).click()
        await self.page.get_by_role('heading', name='Create list', exact=True).wait_for(state='hidden')
        await add.wait_for()
        # Destination name must be visible before any ingredients are submitted.
        await self.page.get_by_role('button', name='Add to ' + name, exact=True).wait_for()
        await add.click()
        await add.wait_for(state='hidden')
        await self.page.goto(ORIGIN + '/shopping-list', wait_until='domcontentloaded')
        link = self.page.get_by_test_id('shopping-lists-list').filter(has=self.page.get_by_test_id('shopping-lists-list-name').filter(has_text=re.compile('^' + re.escape(name) + '$')))
        await link.wait_for()
        path = await link.get_attribute('href')
        if not re.fullmatch(r'/shopping-list/[a-zA-Z0-9-]+', path or ''):
            raise RuntimeError('New list could not be identified')
        self.shopping['source_url'] = ORIGIN + path
        await self.read_shopping()
        if not self.shopping['items']:
            raise RuntimeError('The generated list is empty; check Samsung Food')
        self.state['generated'][key] = {'name': name, 'url': self.shopping['source_url'], 'status': 'saved'}

    async def command(self, command):
        result = self.state['commands'][command['id']]
        result.update(status='running', message='Saving in Samsung Food')
        await self.publish()
        try:
            action = command['action']
            self.stage = action
            if action == 'settings':
                self.state['settings'] = reset_settings(command['settings'])
            else:
                await self.ensure_login()
                if action == 'refresh':
                    await self.sync()
                else:
                    before = await self.read_week(command['week'])
                    if before['revision'] != command['revision']:
                        raise RuntimeError('This week changed in Samsung Food. Refresh and review it before saving.')
                    if action == 'add_meal':
                        await self.add_meal(command)
                    elif action in ('clear_day', 'clear_week'):
                        await self.clear(command['week'], command.get('date') if action == 'clear_day' else None)
                    elif action == 'generate':
                        await self.generate(command)
            result.update(status='saved', message='Saved and checked in Samsung Food')
            self.sync_status = 'ok'
        except Exception as error:
            # Fixed application errors only; no raw browser exceptions or secrets.
            message = str(error) if type(error) is RuntimeError else 'Could not confirm the change. Refresh and check Samsung Food before retrying.'
            result.update(status='uncertain', message=message)
        save('weeks', self.weeks)
        await self.publish()

    async def sync(self):
        await self.ensure_login()
        start = monday(dt.datetime.now(TZ).date())
        for offset in (-1, 0, 1):
            await self.read_week((start + dt.timedelta(days=7 * offset)).isoformat())
        self.weeks = {k: v for k, v in self.weeks.items() if abs((dt.date.fromisoformat(k) - start).days) <= 14}
        await self.read_recipes()
        await self.read_shopping()
        save('weeks', self.weeks)
        self.sync_status = 'ok'
        self.state['last_success'] = now()

    async def run(self):
        listener = asyncio.create_task(self.listen())
        next_sync = 0
        try:
            while True:
                if time.time() >= next_sync:
                    try:
                        await self.sync()
                    except Exception:
                        print('Samsung Food sync failed at: ' + self.stage, flush=True)
                        if self.sync_status != 'login_required':
                            self.sync_status = 'read_failed'
                        self.shopping['sync_status'] = self.sync_status
                    next_sync = time.time() + max(5, int(self.options.get('interval_minutes', 15))) * 60
                    await self.publish()
                await self.publish()
                try:
                    command = await asyncio.wait_for(self.queue.get(), timeout=30)
                    await self.command(command)
                except asyncio.TimeoutError:
                    pass
                if reset_due(self.state['settings'], self.state.get('last_reset'), dt.datetime.now(TZ)):
                    week = monday(dt.datetime.now(TZ).date()).isoformat()
                    # Mark before destructive work: interruption cannot clear newly replanned meals on retry.
                    self.state['last_reset'] = week
                    save('control', self.state)
                    try:
                        await self.ensure_login()
                        await self.clear(week)
                        self.state['reset_error'] = ''
                    except Exception:
                        self.state['reset_error'] = 'Weekly reset could not be confirmed. Review the meal plan.'
                    await self.publish()
        finally:
            listener.cancel()

async def run():
    from playwright.async_api import async_playwright
    os.umask(0o077)
    DATA.mkdir(exist_ok=True)
    options = json.loads((DATA / 'options.json').read_text())
    async with async_playwright() as pw:
        browser = await pw.chromium.launch_persistent_context(str(DATA / 'browser'), headless=True, locale='en-GB', timezone_id='Europe/London')
        page = await browser.new_page()
        page.set_default_timeout(25000)
        await Controller(page, options).run()

if __name__ == '__main__':
    asyncio.run(run())
