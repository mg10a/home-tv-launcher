#!/bin/sh
# Install only the Eufy Viewer custom component, preserving a rollback copy.
# Does NOT restart Home Assistant, update HACS, modify either bridge, or touch
# the stable Home TV Launcher. Run in the Home Assistant Terminal add-on.
set -eu

# Exact commit whose full integration passed Home Assistant 2026.10.3 tests.
SOURCE_REV=93cb332286d7528ab600485d8f117b2fd822ff4a
EXPECTED_VERSION=0.8.49-dev.2
ROOT=${EUFY_VIEWER_CONFIG_ROOT:-/config}
TARGET=$ROOT/custom_components/eufy_viewer
BACKUPS=$ROOT/eufy-viewer-backups
STAGING=$ROOT/eufy-viewer-staging-$$
TEMP=$(mktemp -d)

cleanup() {
    rm -rf "$TEMP"
    if [ -d "$STAGING" ]; then rm -rf "$STAGING"; fi
}
trap cleanup EXIT

if [ ! -f "$TARGET/manifest.json" ]; then
    echo "STOP: Existing integration not found at $TARGET. Nothing changed." >&2
    exit 1
fi
if [ ! -d "$ROOT/custom_components" ]; then
    echo "STOP: Home Assistant config folder is not available." >&2
    exit 1
fi

if [ -n "${EUFY_INSTALL_TEST_ARCHIVE:-}" ]; then
    cp "$EUFY_INSTALL_TEST_ARCHIVE" "$TEMP/source.tar.gz"
else
    if ! command -v curl >/dev/null 2>&1; then
        echo "STOP: curl is not available in this Home Assistant terminal." >&2
        exit 1
    fi
    curl -fL --retry 2 --connect-timeout 15 --max-time 120 \
      -o "$TEMP/source.tar.gz" \
      "https://codeload.github.com/mg10a/home-tv-launcher/tar.gz/$SOURCE_REV"
fi

tar -xzf "$TEMP/source.tar.gz" -C "$TEMP"
MANIFEST=$(find "$TEMP" -type f -path '*/custom_components/eufy_viewer/manifest.json' -print -quit)
if [ -z "$MANIFEST" ] || ! grep -q "\"version\": \"$EXPECTED_VERSION\"" "$MANIFEST"; then
    echo "STOP: Downloaded package has the wrong version. Nothing changed." >&2
    exit 1
fi
SOURCE_DIR=${MANIFEST%/manifest.json}
if [ ! -f "$SOURCE_DIR/identity.py" ] || [ ! -f "$SOURCE_DIR/recordings.py" ] || [ ! -f "$SOURCE_DIR/viewers.py" ]; then
    echo "STOP: Incomplete component archive. Nothing changed." >&2
    exit 1
fi

# Stage on /config filesystem, then preserve the old integration by renaming.
cp -a "$SOURCE_DIR" "$STAGING"
find "$STAGING" -type d -name __pycache__ -prune -exec rm -rf {} \;
mkdir -p "$BACKUPS"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP=$BACKUPS/eufy_viewer_$STAMP-$$
mv "$TARGET" "$BACKUP"
if ! mv "$STAGING" "$TARGET"; then
    mv "$BACKUP" "$TARGET"
    echo "STOP: Install failed; original integration automatically restored." >&2
    exit 1
fi
printf '%s\n' "$BACKUP" > "$BACKUPS/latest-backup-path"
echo "INSTALLED: Eufy Security Viewer $EXPECTED_VERSION"
echo "BACKUP: $BACKUP"
echo "NEXT: Restart Home Assistant from Settings > System, then inspect both Eufy hubs."
echo "To undo this update, run rollback-eufy-dual-hub-dev.sh from the same source."
