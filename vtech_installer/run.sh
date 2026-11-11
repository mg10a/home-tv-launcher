#!/bin/sh
# One-shot installer. Modifies only the vtech_baby code directory; never reads
# Home Assistant config entries, credentials, snapshots, recordings or media.
set -eu

CONFIG_ROOT="${HALO_VTECH_CONFIG_ROOT:-/homeassistant}"
PACKAGE_ROOT="${HALO_VTECH_PACKAGE_ROOT:-/opt/vtech_baby}"
OPTIONS_FILE="${HALO_VTECH_OPTIONS_FILE:-/data/options.json}"

say() { printf '%s\n' "Halo VTech: $*"; }
fail() { say "ERROR: $*" >&2; exit 1; }

[ -d "$CONFIG_ROOT" ] || fail "Home Assistant configuration directory is not mounted."
[ -f "$OPTIONS_FILE" ] || fail "Installer options are not available."
action="$(jq -er '.action // "install"' "$OPTIONS_FILE")" || fail "Cannot read installer action."
case "$action" in install|rollback) ;; *) fail "Action must be install or rollback." ;; esac

COMPONENTS="$CONFIG_ROOT/custom_components"
TARGET="$COMPONENTS/vtech_baby"
BACKUPS="$CONFIG_ROOT/halo_vtech_backups"
POINTER="$BACKUPS/latest-original-backup.txt"

[ ! -L "$COMPONENTS" ] || fail "Refusing a symlinked custom_components directory."
[ ! -L "$TARGET" ] || fail "Refusing a symlinked vtech_baby directory."
[ ! -L "$BACKUPS" ] || fail "Refusing a symlinked backups directory."
mkdir -p "$COMPONENTS" "$BACKUPS"
[ -d "$COMPONENTS" ] && [ -d "$BACKUPS" ] || fail "Expected directories were not available."

stamp="$(date -u '+%Y%m%dT%H%M%SZ')-$$"
STAGING="$COMPONENTS/.halo_vtech_staging_$stamp"
POINTER_TEMP="$BACKUPS/.latest-original-backup-$stamp.tmp"
started=0
completed=0
prior=NONE

cleanup() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ "$started" -eq 1 ] && [ "$completed" -eq 0 ]; then
    # Never destroy the displaced original: restore it if the swap failed.
    if [ -e "$TARGET" ]; then
      mv "$TARGET" "$BACKUPS/failed-deployment-$stamp" || true
    fi
    if [ "$prior" != NONE ] && [ -d "$BACKUPS/$prior" ]; then
      mv "$BACKUPS/$prior" "$TARGET" || true
    fi
    say "Install failed; attempted to restore the previous component."
  fi
  [ ! -e "$STAGING" ] || rm -rf "$STAGING"
  [ ! -e "$POINTER_TEMP" ] || rm -f "$POINTER_TEMP"
  exit "$status"
}
trap cleanup EXIT

if [ "$action" = install ]; then
  [ -d "$PACKAGE_ROOT" ] || fail "Bundled integration source is missing. No changes made."
  [ -f "$PACKAGE_ROOT/manifest.json" ] || fail "Bundled manifest is missing. No changes made."
  [ -f "$PACKAGE_ROOT/vtech_lan/profile.py" ] || fail "Experimental connection profile is missing."
  [ "$(jq -r '.domain' "$PACKAGE_ROOT/manifest.json")" = vtech_baby ] || fail "Unexpected bundled domain."
  [ "$(jq -r '.version' "$PACKAGE_ROOT/manifest.json")" = 0.3.1 ] || fail "Unexpected bundled version."

  # Re-running a successful installer must not overwrite the original rollback.
  if [ -f "$TARGET/manifest.json" ] && cmp -s "$PACKAGE_ROOT/manifest.json" "$TARGET/manifest.json"; then
    say "Experimental component 0.3.1 is already installed; keeping existing backup untouched."
    say "Restart Home Assistant if you have not done so since installing."
    exit 0
  fi

  cp -a "$PACKAGE_ROOT" "$STAGING" || fail "Cannot prepare staged integration."
  [ -f "$STAGING/manifest.json" ] || fail "Staged integration failed validation."

  if [ -e "$TARGET" ]; then
    [ -d "$TARGET" ] || fail "The current vtech_baby path is not a directory."
    prior="original-$stamp"
  fi
  printf '%s\n' "$prior" > "$POINTER_TEMP" || fail "Cannot stage rollback marker."
  if [ "$prior" != NONE ]; then
    [ ! -e "$BACKUPS/$prior" ] || fail "Backup filename collision."
    mv "$TARGET" "$BACKUPS/$prior" || fail "Could not safely back up the existing integration."
  fi
  started=1
  mv "$STAGING" "$TARGET" || fail "Could not activate the integration."
  mv "$POINTER_TEMP" "$POINTER" || fail "Could not record rollback location."
  completed=1
  say "Installed Halo VTech Baby Monitor 0.3.1."
  if [ "$prior" = NONE ]; then
    say "No previous vtech_baby code directory existed; rollback will remove this candidate."
  else
    say "Previous integration saved in /homeassistant/halo_vtech_backups/$prior."
  fi
  say "No credentials or recordings were accessed. Restart Home Assistant, then pair once in Devices & services."
else
  [ -f "$POINTER" ] || fail "No recorded installation to roll back. No changes made."
  prior="$(cat "$POINTER")"
  case "$prior" in NONE|original-[0-9]* ) ;; *) fail "Invalid backup marker; no changes made." ;; esac
  [ -d "$TARGET" ] || fail "Installed candidate is missing; no changes made."
  if [ "$prior" != NONE ]; then
    [ -d "$BACKUPS/$prior" ] || fail "The original component backup is missing; no changes made."
  fi
  quarantine="experimental-$stamp"
  [ ! -e "$BACKUPS/$quarantine" ] || fail "Backup filename collision."
  mv "$TARGET" "$BACKUPS/$quarantine" || fail "Could not preserve the experimental version."
  if [ "$prior" != NONE ]; then
    if ! mv "$BACKUPS/$prior" "$TARGET"; then
      mv "$BACKUPS/$quarantine" "$TARGET" || true
      fail "Restoring the original failed. The experimental version was put back."
    fi
  fi
  rm -f "$POINTER" || fail "Could not clear rollback marker."
  completed=1
  say "Rollback complete. Experimental copy retained in /homeassistant/halo_vtech_backups/$quarantine."
  say "Restart Home Assistant to load the restored integration."
fi
