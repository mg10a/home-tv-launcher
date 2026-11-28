## 0.3.1

- Download tested AMD64/ARM64 images from GitHub Container Registry instead of building on Home Assistant.
- Backups now contain the app settings and saved data without exporting the whole software image.
- Use a smaller Python base and install only the Chromium headless shell used by the app.
- Preserve the existing app slug, options, saved browser profile, meal planner and shopping data.
- Keep Playwright 1.56.0, websockets 15.0.1 and the existing application behaviour.

Restores need internet access to download the public image. Keep published version tags available.
