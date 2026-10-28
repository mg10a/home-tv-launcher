// DEV-only numeric packet observations. No identifiers, keys or media are retained.
const rows = new WeakMap();
export function observeVideoPacket(owner, m, v, bytes, start, encrypted, first, emit = console.info) {
  if (process.env.EUFY_DIAGNOSTICS !== 'true') return;
  let r = rows.get(owner);
  if (!r || first) {
    r = { packets:0, encrypted:0, short_encrypted:0, length_mismatch:0, sequence_gaps:0, annex_b:0, valid_hevc:0, picture_start:0, codec_h264:0, codec_hevc:0, codec_other:0, previous:undefined };
    rows.set(owner,r);
  }
  r.packets++;
  // Bounded numeric protocol enums, never payload bytes or identifiers.
  const streamKey = `stream_type_${v.streamType & 255}`;
  r[streamKey] = (r[streamKey] || 0) + 1;
  if (encrypted) r.encrypted++;
  if (m.signCode > 0 && v.videoDataLength < 128) r.short_encrypted++;
  if (m.data.length - start !== v.videoDataLength || bytes.length !== v.videoDataLength) r.length_mismatch++;
  if(r.previous !== undefined && ((v.videoSeqNo-r.previous+65536)%65536)!==1) r.sequence_gaps++;
  r.previous=v.videoSeqNo;
  r[v.streamType===1?'codec_h264':v.streamType===2?'codec_hevc':'codec_other']++;
  const n = bytes[0]===0 && bytes[1]===0 ? (bytes[2]===1?3:bytes[2]===0&&bytes[3]===1?4:0):0;
  if(n) {
    r.annex_b++;
    if(bytes.length>n) {
      const nalKey = `h264_nal_${bytes[n] & 31}`;
      r[nalKey] = (r[nalKey] || 0) + 1;
    }
    if(bytes.length>=n+3 && !(bytes[n]&128) && (bytes[n+1]&7)) {
      r.valid_hevc++;
      if(((bytes[n]>>1)&63)<=31 && (bytes[n+2]&128)) r.picture_start++;
    }
  }
  if(r.packets===1 || r.packets%20===0) {
    const {previous,...counts}=r;
    emit(JSON.stringify({diagnostic:'dev_video_packets',counts}));
  }
}

// T8030/T8213 observed startup: HEVC pre-roll (marker 1), then H264 live
// (marker 0). Let the SDK initialize its codec/readers from the live SPS.
// Scoped by the caller to DEV live VIDEO on T8030; recordings are unchanged.
const waitingForLive = new WeakSet();
export function skipHevcPreroll(owner, first, scoped, streamType, bytes, emit = console.info) {
  if (!scoped || !first) { waitingForLive.delete(owner); return false; }
  const n = bytes[0]===0 && bytes[1]===0 ? (bytes[2]===1?3:bytes[2]===0&&bytes[3]===1?4:0):0;
  if (!waitingForLive.has(owner)) {
    if (!(streamType===1 && n && bytes.length>=n+2 && bytes[n]===64 && (bytes[n+1]&7))) return false;
    waitingForLive.add(owner);
    emit('{"diagnostic":"dev_preroll","waiting_for_h264":1}');
  }
  if (streamType===0 && n && bytes.length>n && !(bytes[n]&128) && (bytes[n]&31)===7) {
    waitingForLive.delete(owner);
    emit('{"diagnostic":"dev_preroll","live_h264_started":1}');
    return false;
  }
  return true;
}
