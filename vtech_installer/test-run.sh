#!/bin/sh
set -eu
script="$(CDPATH='' cd "$(dirname "$0")" && pwd)/run.sh"
testroot="$(mktemp -d)"
trap 'rm -rf "$testroot"' EXIT
conf="$testroot/config"
source="$testroot/package"
options="$testroot/options.json"
mkdir -p "$conf/custom_components/vtech_baby" "$source/vtech_lan"
printf 'old-version\n' > "$conf/custom_components/vtech_baby/old.py"
printf '{"domain":"vtech_baby","name":"Halo VTech Baby Monitor","version":"0.3.1"}\n' > "$source/manifest.json"
printf '%s\n' '# test connection profile' > "$source/vtech_lan/profile.py"
printf '{"action":"install"}\n' > "$options"
run() {
  HALO_VTECH_CONFIG_ROOT="$conf" HALO_VTECH_PACKAGE_ROOT="$source" HALO_VTECH_OPTIONS_FILE="$options" sh "$script"
}
run
[ -f "$conf/custom_components/vtech_baby/vtech_lan/profile.py" ]
[ "$(find "$conf/halo_vtech_backups" -name old.py | wc -l | tr -d ' ')" = 1 ]
[ ! -f "$conf/custom_components/vtech_baby/old.py" ]
# Idempotence: re-run cannot overwrite the one rollback point.
run
[ "$(find "$conf/halo_vtech_backups" -name old.py | wc -l | tr -d ' ')" = 1 ]
printf '{"action":"rollback"}\n' > "$options"
run
[ -f "$conf/custom_components/vtech_baby/old.py" ]
[ ! -e "$conf/custom_components/vtech_baby/vtech_lan/profile.py" ]
[ ! -e "$conf/halo_vtech_backups/latest-original-backup.txt" ]
# Preflight rejection must not replace the original.
printf '{"action":"install"}\n' > "$options"
rm "$source/vtech_lan/profile.py"
if run; then echo 'missing profile should have failed' >&2; exit 1; fi
[ -f "$conf/custom_components/vtech_baby/old.py" ]
printf '%s\n' '# test connection profile' > "$source/vtech_lan/profile.py"
# Do not follow a symlink pointing outside custom_components.
mv "$conf/custom_components/vtech_baby" "$testroot/original"
ln -s "$testroot/original" "$conf/custom_components/vtech_baby"
if run; then echo 'symlinked target should have failed' >&2; exit 1; fi
[ -f "$testroot/original/old.py" ]
rm "$conf/custom_components/vtech_baby"
# Fresh install with no original has a safe rollback path.
run
[ -f "$conf/custom_components/vtech_baby/manifest.json" ]
printf '{"action":"rollback"}\n' > "$options"
run
[ ! -e "$conf/custom_components/vtech_baby" ]
echo 'One-shot VTech installer tests passed.'
