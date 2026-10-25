#!/usr/bin/env python3
"""Offline FFmpeg isolation for the Eufy live freeze. No Home Assistant access.

With no --input, generates synthetic portrait HEVC. With --input, tests a
LOCAL raw HEVC elementary stream; never uploads footage or prints its path.
Requires ffmpeg with libx264 (and libx265 for synthetic generation).
"""
import argparse
import json
import subprocess
import tempfile
import time
from pathlib import Path


def run(args, timeout=30):
    started = time.monotonic()
    try:
        p = subprocess.run(args, capture_output=True, timeout=timeout, check=False)
        return {"ok": p.returncode == 0, "exit_code": p.returncode,
                "elapsed_seconds": round(time.monotonic() - started, 3),
                "stderr_tail": p.stderr.decode("utf-8", "replace")[-500:]}
    except subprocess.TimeoutExpired:
        return {"ok": False, "timeout": True, "elapsed_seconds": timeout}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Optional local raw HEVC file; do not commit recordings")
    parser.add_argument("--seconds", type=int, default=3)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="eufy-transcode-") as folder:
        folder = Path(folder)
        source = args.input
        if source is None:
            source = folder / "synthetic.hevc"
            generation = run(["ffmpeg", "-hide_banner", "-loglevel", "error",
                "-f", "lavfi", "-i", "testsrc2=size=320x568:rate=10",
                "-t", str(args.seconds), "-c:v", "libx265", "-preset", "ultrafast",
                "-x265-params", "log-level=error", "-f", "hevc", "-y", str(source)], 90)
            if not generation["ok"]:
                print(json.dumps({"generation": generation}, indent=2))
                raise SystemExit(1)
        elif not source.is_file():
            parser.error("--input must be a readable HEVC elementary stream")
        base = ["ffmpeg", "-hide_banner", "-loglevel", "error",
                "-threads", "1", "-framerate", "10", "-f", "hevc", "-i", str(source),
                "-map", "0:v:0"]
        encode = ["-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
                  "-pix_fmt", "yuv420p"]
        clock = f"setpts='(time(0)-{time.time():.3f})/TB'"
        cases = {
            "decode_only": ["-f", "null", "-"],
            "decode_encode": encode + ["-vf", "scale='min(1920,iw)':-2", "-f", "null", "-"],
            "bridge_like": encode + ["-crf", "26", "-maxrate", "4000000",
                "-bufsize", "2000000", "-vf", clock + ",scale='min(1920,iw)':-2",
                "-threads", "1", "-g", "30", "-fps_mode", "vfr",
                "-enc_time_base", "1:90000", "-mpegts_flags", "+resend_headers",
                "-muxdelay", "0", "-muxpreload", "0", "-f", "mpegts",
                str(folder / "bridge.ts")],
        }
        results = {name: run(base + options) for name, options in cases.items()}
        print(json.dumps({"source": "local_private" if args.input else "synthetic",
                          "ffmpeg_tests": results}, indent=2))
        if not all(item["ok"] for item in results.values()):
            raise SystemExit(1)


if __name__ == "__main__":
    main()
