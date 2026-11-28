"""Offline smoke test: imports, extraction scripts and persistent Chromium state."""
import asyncio
import tempfile
from pathlib import Path

from playwright.async_api import async_playwright
import bridge
import control


async def main():
    assert control.TZ.key == 'Europe/London'
    with tempfile.TemporaryDirectory() as profile:
        async with async_playwright() as pw:
            context = await pw.chromium.launch_persistent_context(
                profile, headless=True, locale='en-GB', timezone_id='Europe/London')
            page = await context.new_page()
            await page.route('https://fixture.invalid/**', lambda route: route.fulfill(
                body='<html><body><h1>Samsung Food image test</h1></body></html>',
                content_type='text/html'))
            await page.goto('https://fixture.invalid/')
            assert await page.locator('h1').inner_text() == 'Samsung Food image test'
            await context.add_cookies([{'name': 'fixture', 'value': 'persisted',
                'url': 'https://fixture.invalid', 'expires': 2000000000}])
            for filename in ('extract.js', 'extract-shopping.js'):
                # Compile the exact packaged scripts without needing a live account.
                await page.evaluate('(source) => { new Function("return (" + source + ")"); }',
                                    Path('/app', filename).read_text())
            await context.close()
            context = await pw.chromium.launch_persistent_context(profile, headless=True)
            assert any(c['name'] == 'fixture' and c['value'] == 'persisted'
                       for c in await context.cookies('https://fixture.invalid'))
            await context.close()
    print('PASS: app imports, timezone, Chromium, packaged scripts and saved browser profile')


asyncio.run(main())
