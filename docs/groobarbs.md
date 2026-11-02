# Experimental Groobarbs connector — 0.1.0

Not installed or live-tested. This is an unofficial integration based on Groobarbs' public website assets observed 2 November 2026, not a supported public API.

## Prepared implementation

- Private Home Assistant client with an in-memory cookie jar and no credential logging.
- Read-only sensor: `sensor.groobarbs_next_delivery`, refreshed every 30 minutes.
- Delivery date, cutoff, editability, item quantities, totals, box contents, swap count and available replacements.
- Eggs, coffee and other items remain separate order lines.
- Address, delivery notes, account profile and payment details excluded from sensor attributes.
- Swap client checks current data against the reviewed snapshot, item categories, swap allowance and delivery editability. No mutation retries. No swap service is exposed yet.

## Installation for a live read test (requires owner approval)

1. Copy `custom_components/groobarbs` to Home Assistant's `/config/custom_components/groobarbs`.
2. Add the following configuration, with credentials entered privately into HA secrets, never GitHub or chat:

```yaml
groobarbs:
  email: !secret groobarbs_email
  password: !secret groobarbs_password
```

3. Validate Home Assistant configuration, then restart after approval.
4. Compare the sensor's date, contents, swaps and separate extras with the Groobarbs account page.

Rollback: remove the `groobarbs` configuration, restart, then remove the integration directory and its secrets.

## Remaining validation before dashboard editing

- Test sign-in against the account: website may require an email-check step or additional authentication.
- Test session expiry and network failures without repeated authentication attempts.
- Confirm actual live payload types, replacement IDs and response semantics.
- Add the dashboard contents panel and reviewed swap confirmation, showing the bespoke surcharge (£1 shown by the website) before any write.
- Only enable a Home Assistant write service after a user-chosen swap has been confirmed and verified end to end. Never change a real order merely to test.

## Evidence

Public frontend: `https://my.groobarbs.co.uk/build/assets/Dashboard-C49SiE8V.js`, `DeliveryCalendar-CU7Zka7b.js`, `Login-DJ1TRR0K.js`; route definitions in the public login page. The frontend posts `replacement_id` to `/orders/{order}/items/{item}/content/{content}/swap`; reset uses DELETE at that route. Changes are immediate; the contents modal's Done button only closes it.
