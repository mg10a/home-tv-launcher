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

## Responsive month / family views

The overview and expanded calendar now offer Month and Family organiser. Month
contains person and shared/holiday sources. The family planner has one date gutter
and five content columns: four configured people, then Other (shared, holiday and
birthday sources). Meals stay separate. Private settings version 2 adds role
person/birthday and a people array specifying the four column names/order.
Existing choices are preserved until saved; source IDs are never inferred from
person names. Configure roles and names in Calendars & names.

The birthday card uses a separate date range relative to UK today: seven previous
days, today, and 28 following days, irrespective of the displayed calendar month.
Each occurrence comes from HA; no birthdays or ages are manufactured.

Portrait layouts fit all calendar dates into the available height. Cells contain
bounded summaries and event counts; tapping opens complete details. Landscape
family planners scroll vertically when their 28–31 rows exceed the available
height. Month grids use four to six complete weeks. Tablet overviews rearrange
cards by orientation; tiny windows have a scroll fallback. Arbitrarily many event
texts cannot all be displayed without scrolling, so cells and birthday sections
retain detail views rather than shrink text indefinitely.

The current main screen and calendar view/month are stored on the device, so
reloads/recreation restore navigation. Android handles orientation/size changes
without recreating its WebView in builds from 4.0.2. The web persistence fallback
also applies to earlier APKs. No credentials are part of navigation state.

Use dev/layout-check.html for phone/tablet/TV viewport checks and rotation.
