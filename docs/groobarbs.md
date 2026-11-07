# Groobarbs connector

This is an unofficial integration based on Groobarbs' public website assets observed 2 November 2026, not a supported public API.

## Initial implementation — 0.1.0

- Private Home Assistant client with an in-memory cookie jar and no credential logging.
- Read-only sensor: `sensor.groobarbs_next_delivery`, refreshed every 30 minutes.
- Delivery date, cutoff, editability, item quantities, totals, box contents, swap count and available replacements.
- Eggs, coffee and other items remain separate order lines.
- Address, delivery notes, account profile and payment details excluded from sensor attributes.
- Swap client checks current data against the reviewed snapshot, item categories, swap allowance and delivery editability. No mutation retries. No swap service is exposed yet.

## Installation status — 2 November 2026

Version 0.1.1 files were installed in `/homeassistant/custom_components/groobarbs` from commit `151cf465a0b74828bbf64f2ac946729c2343f898`. Python syntax and JSON validation passed. Home Assistant's configuration check reported valid. An owner-approved Core restart was requested; post-restart setup and live account validation remain pending.

Setup now uses Settings → Devices & services → Add integration → Groobarbs. Enter credentials privately in the integration form; no configuration.yaml or secrets.yaml edits are needed. No order-change service is exposed.

Rollback: remove the integration entry if configured, remove the added `custom_components/groobarbs` directory, then restart after approval. Existing configuration files were not modified.

## Remaining validation before dashboard editing

- Test sign-in against the account: website may require an email-check step or additional authentication.
- Test session expiry and network failures without repeated authentication attempts.
- Confirm actual live payload types, replacement IDs and response semantics.
- Add the dashboard contents panel and reviewed swap confirmation, showing the bespoke surcharge (£1 shown by the website) before any write.
- Only enable a Home Assistant write service after a user-chosen swap has been confirmed and verified end to end. Never change a real order merely to test.

## Evidence

Public frontend: `https://my.groobarbs.co.uk/build/assets/Dashboard-C49SiE8V.js`, `DeliveryCalendar-CU7Zka7b.js`, `Login-DJ1TRR0K.js`; route definitions in the public login page. The frontend posts `replacement_id` to `/orders/{order}/items/{item}/content/{content}/swap`; reset uses DELETE at that route. Changes are immediate; the contents modal's Done button only closes it.

## Restore original item in 0.3.0

The dashboard's **Keep [original]** choice uses `groobarbs.reset` for an item
that was already swapped. This sends Groobarbs' own DELETE request after
checking the delivery window and reviewed box revision. The integration then
verifies the restored product and publishes the supplier's swap count. It
checks the box after uncertain responses and does not repeat the write.

Update the existing manually installed component in Home Assistant before using
the dashboard's direct restore. The Groobarbs credentials and config entry stay
in Home Assistant. From its Terminal, download the three changed files into a
temporary directory, back up the installed component, and replace those files:

```sh
(
  set -eu
  cd /homeassistant/custom_components
  [ -f groobarbs/manifest.json ]
  stage=$(mktemp -d)
  trap 'rm -rf "$stage"' EXIT
  source=https://raw.githubusercontent.com/mg10a/home-tv-launcher/main/custom_components/groobarbs
  for file in __init__.py client.py manifest.json; do
    curl -fsSL "$source/$file" -o "$stage/$file"
  done
  grep -q '"version": "0.3.0"' "$stage/manifest.json"
  cp -a groobarbs "../groobarbs-backup-$(date +%Y%m%d-%H%M%S)"
  cp "$stage/"* groobarbs/
)
```

Restart Home Assistant Core after the copy succeeds so it loads the new Python
code. Reopen Halo and use **Change → Keep [original] → Restore original item**.
The dashboard links to Groobarbs itself for restoration while the older
integration is installed. No change is sent when keeping an unswapped item.
