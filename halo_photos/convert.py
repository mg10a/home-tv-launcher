import json, os, time, hashlib, urllib.request
from pathlib import Path
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener
register_heif_opener()
Image.MAX_IMAGE_PIXELS = 80000000
ROOT = Path('/homeassistant/dashboard_photos')
CACHE = Path('/data/converted.json')
try:
    known = json.loads(CACHE.read_text())
except (OSError, ValueError):
    known = {}
def save():
    tmp = CACHE.with_suffix('.tmp')
    tmp.write_text(json.dumps(known))
    tmp.replace(CACHE)
def refresh():
    req = urllib.request.Request('http://supervisor/core/api/services/button/press',
        data=json.dumps({'entity_id':'button.album_slideshow_family_photos_refresh_album'}).encode(),
        headers={'Authorization':'Bearer '+os.environ['SUPERVISOR_TOKEN'],'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        response.read()
pending = False
while True:
    converted = failed = 0
    for source in ROOT.rglob('*'):
        if source.suffix.lower() not in ('.heic', '.heif') or source.is_symlink():
            continue
        try:
            stat = source.stat()
            if time.time() - stat.st_mtime < 30:
                continue
            key = str(source.relative_to(ROOT))
            stamp = [stat.st_size, stat.st_mtime_ns]
            digest = hashlib.sha256(key.encode()).hexdigest()[:20]
            target = ROOT / ('halo-display-' + digest + '.jpg')
            if known.get(key) == stamp and target.exists():
                continue
            with Image.open(source) as original:
                image = ImageOps.exif_transpose(original).convert('RGB')
                image.thumbnail((2560,2560))
                tmp = target.with_suffix('.tmp')
                image.save(tmp, format='JPEG', quality=90, optimize=True)
            if [source.stat().st_size,source.stat().st_mtime_ns] != stamp:
                tmp.unlink(missing_ok=True)
                continue
            tmp.replace(target)
            known[key] = stamp
            save()
            converted += 1
            pending = True
        except Exception:
            failed += 1
    if pending:
        try:
            refresh()
            pending = False
        except Exception:
            print('Album refresh pending; retrying next minute', flush=True)
    if converted or failed:
        print(f'Converted {converted} photos; {failed} files will be retried', flush=True)
    time.sleep(60)
