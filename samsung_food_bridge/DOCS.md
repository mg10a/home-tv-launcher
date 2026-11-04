# Samsung Food meal planner and shopping
Version 0.3.0 uses the rendered Samsung Food website. It is experimental and is not an official Samsung API integration.

The dashboard can select saved recipes, add meals to individual days, clear a day or week, and create a dated shopping list from a week. Recipe servings are the servings stored in Samsung Food. Existing shopping lists are preserved. Repeating the same successful submission reuses its generated list.

## Connection and privacy
Credentials and the persistent browser profile stay in the app's private /data directory. No Samsung credentials are sent to GitHub Pages. Commands use the existing authenticated Home Assistant WebSocket and the samsung_food_command event. The bridge accepts authenticated user events only; Home Assistant requires an administrator to fire events. There are no public inbound ports.

The session is reused. If sign-in expires, the bridge attempts the saved login with increasing cooldown; verification challenges still require the account owner. Configure Start on boot in Home Assistant. Website changes may require a bridge update.

## Weekly reset
Default: enabled, Sunday 13:00 Europe/London. Change or disable under Meals > Weekly reset. The reset clears only the finishing week's scheduled meals, preserves next week's meals, recipes and shopping lists, and keeps the last 20 pre-clear snapshots privately for troubleshooting. It runs once per Monday-based week; an interrupted reset is not repeated automatically. A reset failure is shown in the dashboard.

## Write safety
Every command has an ID and an expected week revision. A conflicting edit stops the write. Commands are serialized. An interrupted or uncertain shopping submission is never replayed automatically. Read back Samsung Food before retrying. Duplicate saved recipe cards which cannot be distinguished are rejected rather than guessed.

## Upgrade
Upgrade the app in Home Assistant, then refresh the dashboard. Native Samsung Food opening requires Home TV Launcher 4.0.5; older APKs display an address-copy fallback. The web dashboard opens Samsung Food directly.
