#!/usr/bin/env python3
"""Private local HEVC Annex-B structure audit. Emits counts only, never payloads.

Usage: python3 hevc-nal-audit.py /path/to/local-capture.hevc
HEVC NAL types: 32 VPS, 33 SPS, 34 PPS, 19/20 IDR, 21 CRA,
0..31 VCL slices. An elementary stream may start without parameter sets.
"""
import argparse
import json
from collections import Counter
from pathlib import Path


def units(data):
    positions = []
    i = 0
    while i + 3 < len(data):
        if data[i:i+3] == b"\x00\x00\x01":
            positions.append((i, 3))
            i += 3
        elif data[i:i+4] == b"\x00\x00\x00\x01":
            positions.append((i, 4))
            i += 4
        else:
            i += 1
    for n, (start, width) in enumerate(positions):
        end = positions[n + 1][0] if n + 1 < len(positions) else len(data)
        payload = data[start + width:end]
        if len(payload) >= 2:
            yield ((payload[0] >> 1) & 0x3f), len(payload)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    args = parser.parse_args()
    if not args.input.is_file():
        parser.error("input must be a local raw Annex-B HEVC file")
    counts = Counter()
    sizes = Counter()
    total = 0
    for kind, size in units(args.input.read_bytes()):
        counts[kind] += 1
        sizes[kind] += size
        total += 1
    print(json.dumps({
        "nal_total": total,
        "nal_types": {str(k): v for k, v in sorted(counts.items())},
        "nal_payload_bytes": {str(k): v for k, v in sorted(sizes.items())},
        "vps": counts[32], "sps": counts[33], "pps": counts[34],
        "idr": counts[19] + counts[20], "cra": counts[21],
        "vcl": sum(counts[k] for k in range(32)),
        "warning": "NAL counts alone do not establish decodability or root cause.",
    }, indent=2))


if __name__ == "__main__":
    main()
