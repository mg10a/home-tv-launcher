"""Experimental UI reader. No private Samsung API calls or writes to Samsung Food."""
import asyncio
import datetime as dt
import json
import os
import re
from pathlib import Path
import urllib.request

DATA = Path('/data')
ORIGIN = 'https://app.samsungfood.com'
ENTITY = 'sensor.samsung_food_meal_plan'
SHOPPING_ENTITY = 'sensor.samsung_food_shopping_list'


def validate(days):
    if not isinstance(days, list) or len(days) != 7:
        raise ValueError('week_incomplete')
    dates = [dt.date.fromisoformat(day['date']) for day in days]
    if dates != sorted(set(dates)) or any((b-a).days != 1 for a,b in zip(dates,dates[1:])):
        raise ValueError('invalid_dates')
    for day in days:
        if not isinstance(day['meals'], list):
            raise ValueError('invalid_meals')
        for meal in day['meals']:
            if not isinstance(meal.get('title'), str) or not meal['title'].strip():
                raise ValueError('invalid_title')
            if not isinstance(meal.get('slot'), str) or not meal['slot'].strip():
                raise ValueError('invalid_slot')
    return days


def validate_shopping(value):
    if not isinstance(value, dict) or not isinstance(value.get('name'), str) or not value['name'].strip():
        raise ValueError('invalid_shopping_list')
    if not isinstance(value.get('source_url'), str) or not re.fullmatch(
            r'https://app\.samsungfood\.com/shopping-list/[a-zA-Z0-9-]+', value['source_url']):
        raise ValueError('invalid_shopping_url')
    if not isinstance(value.get('items'), list):
        raise ValueError('invalid_shopping_items')
    for item in value['items']:
        if not isinstance(item, dict):
            raise ValueError('invalid_shopping_item')
        if not isinstance(item.get('name'), str) or not item['name'].strip() or len(item['name']) > 500:
            raise ValueError('invalid_shopping_name')
        if not isinstance(item.get('quantity'), str) or len(item['quantity']) > 300:
            raise ValueError('invalid_shopping_quantity')
        if not isinstance(item.get('completed'), bool):
            raise ValueError('invalid_shopping_completion')
    return value


def publish_shopping(status, snapshot):
    attributes = {'friendly_name': 'Samsung Food shopping list', 'icon': 'mdi:cart',
                  'read_only': True, 'source_url': snapshot.get('source_url', ORIGIN + '/shopping-list'),
                  'name': snapshot.get('name', ''), 'items': snapshot.get('items', []),
                  'last_success': snapshot.get('last_success'), 'sync_status': status}
    publish_state(SHOPPING_ENTITY, status, attributes)


def publish_state(entity, status, attributes):
    request = urllib.request.Request(
        'http://supervisor/core/api/states/' + entity,
        data=json.dumps({'state': status, 'attributes': attributes}).encode(),
        headers={'Authorization': 'Bearer ' + os.environ['SUPERVISOR_TOKEN'],
                 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status not in (200, 201):
            raise RuntimeError('ha_publish_failed')


def publish(status, snapshot):
    attributes = {'friendly_name': 'Samsung Food meal plan', 'icon': 'mdi:food',
                  'read_only': True, 'source_url': ORIGIN + '/meal-plan',
                  'days': snapshot.get('days', []),
                  'last_success': snapshot.get('last_success'),
                  'sync_status': status}
    publish_state(ENTITY, status, attributes)


async def login(page, options):
    # One attempt per process start. An expired session stops sync until restart.
    print('Samsung Food stage: opening_login', flush=True)
    await page.get_by_role('button', name='Log in', exact=True).click()
    print('Samsung Food stage: choosing_email', flush=True)
    await page.get_by_role('button', name='Use email or phone', exact=True).click()
    print('Samsung Food stage: entering_email', flush=True)
    await page.get_by_role('textbox', name='Email or phone number', exact=True).fill(options['email'])
    print('Samsung Food stage: submitting_email', flush=True)
    await page.get_by_role('button', name='Continue', exact=True).click()
    print('Samsung Food stage: choosing_password', flush=True)
    await page.get_by_role('button', name='Use password instead', exact=True).click(timeout=20000)
    print('Samsung Food stage: entering_password', flush=True)
    await page.get_by_role('textbox', name='Password', exact=True).fill(options['password'])
    print('Samsung Food stage: submitting_password', flush=True)
    await page.get_by_role('button', name='Log in', exact=True).last.click()
    print('Samsung Food stage: waiting_for_sign_in', flush=True)
    await page.get_by_role('button', name='Log in', exact=True).first.wait_for(state='hidden', timeout=20000)
    await page.get_by_role('link', name='Planner', exact=True).wait_for()


async def main():
    from playwright.async_api import async_playwright, TimeoutError
    os.umask(0o077)
    DATA.mkdir(exist_ok=True)
    options = json.loads((DATA / 'options.json').read_text())
    interval = max(5, min(120, int(options.get('interval_minutes', 15)))) * 60
    snapshot = {}
    try:
        snapshot = json.loads((DATA / 'last-success.json').read_text())
        validate(snapshot['days'])
    except (OSError, ValueError, KeyError, TypeError):
        snapshot = {}

    shopping_snapshot = {}
    try:
        shopping_snapshot = validate_shopping(json.loads((DATA / 'last-shopping-success.json').read_text()))
    except (OSError, ValueError, KeyError, TypeError):
        shopping_snapshot = {}

    async def report_shopping(status):
        print('Samsung Food shopping sync: ' + status, flush=True)
        try:
            await asyncio.to_thread(publish_shopping, status, shopping_snapshot)
        except Exception:
            print('Samsung Food shopping sync: ha_publish_failed', flush=True)

    async def report(status):
        # Never log exceptions, page content, account identifiers or credentials.
        print('Samsung Food sync: ' + status, flush=True)
        try:
            await asyncio.to_thread(publish, status, snapshot)
        except Exception:
            print('Samsung Food sync: ha_publish_failed', flush=True)

    await report('starting')
    await report_shopping('starting')
    if not options.get('email') or not options.get('password'):
        await report('login_required')
        await report_shopping('login_required')
        return
    async with async_playwright() as pw:
        browser = await pw.chromium.launch_persistent_context(
            str(DATA / 'browser'), headless=True, locale='en-GB', timezone_id='Europe/London')
        page = await browser.new_page()
        page.set_default_timeout(20000)
        try:
            print('Samsung Food stage: opening_planner', flush=True)
            await page.goto(ORIGIN + '/meal-plan', wait_until='domcontentloaded')
            print('Samsung Food stage: waiting_for_account_or_login', flush=True)
            # The hydrated page exposes the account button or a login button.
            await page.get_by_role('button').filter(has_text=options['email']).or_(
                page.get_by_role('button', name='Log in', exact=True)).first.wait_for()
            if await page.get_by_role('button', name='Log in', exact=True).count():
                await login(page, options)
        except Exception as error:
            # Log only a fixed error category, never exception text or page data.
            category = 'timeout' if isinstance(error, TimeoutError) else 'browser_error'
            print('Samsung Food login failure: ' + category, flush=True)
            await report('login_required')
            await report_shopping('login_required')
            await browser.close()
            return
        failures = 0
        while True:
            try:
                await page.goto(ORIGIN + '/meal-plan', wait_until='domcontentloaded')
                await page.locator('[data-testid="488a6f56-583c-ee62-d353-df8debed9e3f"]').nth(6).wait_for()
                # Visible recipe cards must finish loading before extraction.
                await page.wait_for_timeout(3000)
                days = validate(await page.evaluate(Path('/app/extract.js').read_text()))
                snapshot = {'days': days, 'last_success': dt.datetime.now(dt.timezone.utc).isoformat()}
                temporary = DATA / 'last-success.tmp'
                temporary.write_text(json.dumps(snapshot))
                temporary.replace(DATA / 'last-success.json')
                await report('ok')
                failures = 0
            except Exception:
                if await page.get_by_role('button', name='Log in', exact=True).count():
                    await report('login_required')
                    await report_shopping('login_required')
                    break
                failures += 1
                await report('read_failed')
                if failures >= 3:
                    break
            # Shopping failures have their own status and preserve the last successful list.
            try:
                shopping_url = shopping_snapshot.get('source_url', ORIGIN + '/shopping-list')
                await page.goto(shopping_url, wait_until='domcontentloaded')
                await page.get_by_role('searchbox', name='Add item', exact=True).wait_for()
                await page.wait_for_timeout(3000)
                shopping = validate_shopping(await page.evaluate(Path('/app/extract-shopping.js').read_text()))
                shopping['last_success'] = dt.datetime.now(dt.timezone.utc).isoformat()
                temporary = DATA / 'last-shopping-success.tmp'
                temporary.write_text(json.dumps(shopping))
                temporary.replace(DATA / 'last-shopping-success.json')
                shopping_snapshot = shopping
                await report_shopping('ok')
            except Exception:
                if await page.get_by_role('button', name='Log in', exact=True).count():
                    await report_shopping('login_required')
                    break
                await report_shopping('read_failed')
            await asyncio.sleep(interval * min(4, 2 ** failures))
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
