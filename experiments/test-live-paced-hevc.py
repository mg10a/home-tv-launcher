#!/usr/bin/env python3
"""Offline bridge-like FFmpeg test with paced HEVC stdin and drained stdout.

Uses synthetic video by default. Optional --input is a LOCAL raw .hevc file;
do not upload private camera footage to a public repository.
"""
import argparse
import json
import subprocess
import tempfile
import threading
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--seconds", type=int, default=5)
    parser.add_argument("--chunk-bytes", type=int, default=2048)
    parser.add_argument("--chunk-delay-ms", type=float, default=18)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="eufy-paced-") as directory:
        source = args.input or Path(directory) / "synthetic.hevc"
        if args.input is None:
            generation = subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-f", "lavfi", "-i", "testsrc2=size=320x568:rate=10",
                "-t", str(args.seconds), "-c:v", "libx265", "-preset", "ultrafast",
                "-x265-params", "log-level=error:pools=1:frame-threads=1",
                "-f", "hevc", "-y", str(source),
            ], capture_output=True, timeout=60)
            if generation.returncode:
                raise SystemExit("Synthetic HEVC generation failed")
        if not source.is_file():
            parser.error("--input must point to a local HEVC file")
        payload = source.read_bytes()
        origin = time.time()
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-threads", "1",
            "-probesize", "32768", "-analyzeduration", "100000",
            "-framerate", "10", "-f", "hevc", "-i", "pipe:0", "-map", "0:v:0",
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
            "-crf", "26", "-maxrate", "4000000", "-bufsize", "2000000",
            "-pix_fmt", "yuv420p",
            "-vf", f"setpts='(time(0)-{origin:.3f})/TB',scale='min(1920,iw)':-2",
            "-threads", "1", "-g", "30", "-fps_mode", "vfr",
            "-enc_time_base", "1:90000", "-mpegts_flags", "+resend_headers",
            "-muxdelay", "0", "-muxpreload", "0", "-f", "mpegts", "pipe:1",
        ]
        process = subprocess.Popen(command, stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        output = []
        reader = threading.Thread(target=lambda: output.append(process.stdout.read()), daemon=True)
        reader.start()
        offset = 0
        started = time.monotonic()
        try:
            while offset < len(payload):
                chunk = payload[offset:offset + args.chunk_bytes]
                process.stdin.write(chunk)
                process.stdin.flush()
                offset += len(chunk)
                time.sleep(args.chunk_delay_ms / 1000)
            process.stdin.close()
            returncode = process.wait(timeout=20)
        except (BrokenPipeError, subprocess.TimeoutExpired):
            process.kill()
            returncode = -1
        reader.join(timeout=2)
        result = {
            "source": "local_private" if args.input else "synthetic",
            "input_bytes": len(payload), "fed_bytes": offset,
            "output_bytes": sum(map(len, output)),
            "elapsed_seconds": round(time.monotonic() - started, 3),
            "exit_code": returncode,
            "ok": returncode == 0 and bool(output and output[0]),
            "stderr_tail": process.stderr.read().decode("utf-8", "replace")[-500:],
        }
        print(json.dumps(result, indent=2))
        if not result["ok"]:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
