# Family organiser calendar

Production and DEV load the shared family-calendar.js/css module. It reuses the
existing authenticated HA WebSocket and global request ID counter. It only reads
calendar events with calendar.get_events; no Google credentials or calendar
contents are bundled, cached in localStorage, or included in the repository.

Calendar settings are saved with frontend/set_user_data under
home_tv_family_calendars_v1. They follow the same HA user across devices and are
loaded again on reconnect. Different HA users have independent choices. The
Calendars control lists available entities, permits display names/colours and
assigns each to the agenda, the meal plan, or neither. Future calendar labels are
explicit placeholders, never synthetic events or newly created calendars.

The overview shows the current Monday–Sunday week. The expanded calendar supports
week and month navigation. Meals remain in the current week's separate menu.
Dates use Europe/London, including DST and exclusive all-day end dates. Multiple
occurrences and overlapping events are preserved. Events present in two selected
calendars retain each calendar's attribution, rather than silently deduplicating.

Events refresh every five minutes while visible, on reconnect, on calendar state
changes and via Refresh. Upstream Google/HA caching may delay external edits.
Errors are displayed per calendar; partial failures never become empty calendars.
Disconnects clear rendered events and invalidate pending responses. Settings are
only replaced after HA confirms a successful save.

Run: node --test tests/family-calendar.test.cjs tests/production-launcher.test.cjs
and node --test dev/tests/eufy-dashboard.test.cjs.

Manual checks: save choices, reload with the same account, verify exact duplicate
calendar IDs, filter off/on, change week/month, check all-day/multi-day events and
empty meals, disconnect/reconnect, and navigate settings with keyboard/TV remote.
