# Live freeze: cross-session evidence from supplied HA diagnostics

**Scope:** analysis only. No live bridge changes, no raw video retained.

User-provided `eufy-diagnostics.json` and `eufy-diagnostics (1).json` include 12 live-video session records. **10** have encoder progress age >5 seconds at end and still have P2P input arriving within 80 ms of session end. All ten have `readers.backpressure = 0`.

| Capture | Attempt | Session ms | Last P2P input age ms | FFmpeg progress age ms | Encoder frames | TS output age ms | JPEG age ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| first | 237886510894929 | 18683 | 80 | 10755 | 37 | 10151 | 10175 |
| first | 207079061486506 | 15418 | 30 | 9906 | 12 | 7150 | 10227 |
| first | 228458361945043 | 15917 | 15 | 9544 | 24 | 6786 | 10099 |
| first | 81465019151946 | 18098 | 42 | 13059 | 12 | 10129 | 10153 |
| first | 49810843325629 | 17360 | 6 | 12757 | 12 | 10051 | 10075 |
| first | 13864476447320 | 14878 | 57 | 9729 | 12 | 7207 | 10006 |
| second | 11651137483035 | 14565 | 48 | 9907 | 12 | 7233 | 10121 |
| second | 9693804824064 | 18358 | 2 | 12765 | 12 | 10014 | 10038 |
| second | 185748811517928 | 13564 | 19 | 8155 | 12 | 5348 | 5369 |
| second | 129221960438626 | 14766 | 37 | 9723 | 12 | 6742 | 10004 |

**Observations:** Seven of ten stalled sessions report exactly 12 encoder frames; others report 24 or 37. This could reflect frame/GOP or decode/reconfiguration behavior, but cannot prove it without decoder-level error messages or representative input bitstream. Reader backpressure was absent. FFmpeg processes did not report an exit before stream termination.

**Priority next experiment:** compare decoder output frame count and HEVC NAL/parameter-set behavior across a stall using a private, locally retained short HEVC capture or bridge-only counters (never upload private footage). Test on the bridge's actual FFmpeg 5.1 version. Instrument *bounded counts only* for FFmpeg decoder errors, frame progress and input NAL types; redact all payloads and credentials. Do not assume the output process is hung simply because the camera input keeps arriving: it may be receiving data that cannot form decodable frames.

**Safety:** No change to production HA Yellow, no stable launcher modification, and no claim of a verified fix. Recordings extension remains separate prototype pending a single combined tested install.
