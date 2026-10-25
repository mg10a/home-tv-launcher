#!/bin/sh
# Synthetic camera-like paced HEVC -> H.264/MPEG-TS using the DEV runtime's
# actual FFmpeg build, to catch unsupported flags or a decoder regression.
set -eu
ffmpeg -version | head -n 1 | grep -E '^ffmpeg version 7\.'
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'testsrc2=size=320x568:rate=10' \
  -frames:v 30 -threads 1 -c:v libx265 -preset ultrafast \
  -x265-params 'pools=1:wpp=0:log-level=error' -f hevc "$tmp/input.hevc"
origin="$(date +%s.%3N)"
ffmpeg -hide_banner -loglevel error -y -threads 1 -probesize 32768 -analyzeduration 100000 \
  -re -framerate 10 -f hevc -i "$tmp/input.hevc" -map 0:v:0 \
  -c:v libx264 -preset ultrafast -tune zerolatency -crf 26 -maxrate 1500000 -bufsize 750000 \
  -pix_fmt yuv420p -vf "setpts='(time(0)-${origin})/TB',scale='min(1920,iw)':-2" \
  -threads 1 -g 30 -fps_mode vfr -enc_time_base 1:90000 \
  -mpegts_flags +resend_headers -muxdelay 0 -muxpreload 0 -f mpegts "$tmp/output.ts"
frames="$(ffprobe -v error -select_streams v:0 -count_packets \
 -show_entries stream=nb_read_packets -of default=noprint_wrappers=1:nokey=1 "$tmp/output.ts")"
if [ -z "$frames" ] || [ "$frames" -lt 20 ]; then
 echo "FAIL: insufficient H264 packets from paced HEVC: $frames"
 exit 1
fi
echo "PASS: FFmpeg 7.1 decoded 30 paced HEVC input frames and emitted $frames MPEG-TS packets"
