#!/bin/sh
# Restore the exact previous Eufy Viewer custom component from the installer's
# rollback copy. Does not change either bridge or restart Home Assistant.
set -eu
ROOT=${EUFY_VIEWER_CONFIG_ROOT:-/config}
TARGET=$ROOT/custom_components/eufy_viewer
BACKUPS=$ROOT/eufy-viewer-backups
POINTER=$BACKUPS/latest-backup-path
STAGING=$ROOT/eufy-viewer-restore-$$

cleanup() {
    if [ -d "$STAGING" ]; then rm -rf "$STAGING"; fi
}
trap cleanup EXIT

if [ ! -f "$POINTER" ]; then
    echo "STOP: No rollback backup pointer; do not delete any files." >&2
    exit 1
fi
BACKUP=$(cat "$POINTER")
case "$BACKUP" in
    "$BACKUPS"/eufy_viewer_*) ;;
    *) echo "STOP: Backup location is unexpected." >&2; exit 1 ;;
esac
if [ ! -f "$BACKUP/manifest.json" ] || [ ! -f "$TARGET/manifest.json" ]; then
    echo "STOP: Current integration or original backup is incomplete." >&2
    exit 1
fi
cp -a "$BACKUP" "$STAGING"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FAILED=$BACKUPS/replaced_dev_$STAMP-$$
mv "$TARGET" "$FAILED"
if ! mv "$STAGING" "$TARGET"; then
    mv "$FAILED" "$TARGET"
    echo "STOP: Rollback failed; previous DEV integration restored." >&2
    exit 1
fi
echo "RESTORED: Original Eufy Viewer integration from $BACKUP"
echo "DEV integration retained for inspection at $FAILED"
echo "NEXT: Restart Home Assistant from Settings > System."
