"""Build an installable integration ZIP using only version-controlled source types."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent
pkg = root / 'custom_components' / 'vtech_baby'
version = json.loads((pkg / 'manifest.json').read_text())['version']
out = root / 'dist' / f'halo-vtech-{version}.zip'
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    files = [p for p in pkg.rglob('*') if p.is_file() and
             '__pycache__' not in p.parts and p.suffix in {'.py', '.json', '.svg'}]
    for path in sorted(files):
        info = zipfile.ZipInfo(path.relative_to(root).as_posix(), (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
    for name in ('LICENSE', 'README.md'):
        info = zipfile.ZipInfo('custom_components/vtech_baby/' + name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, (root / name).read_bytes())
print(out)
