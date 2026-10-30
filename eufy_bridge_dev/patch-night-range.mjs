import {readFileSync,writeFileSync} from 'node:fs';
function change(path,oldText,newText){
 const src=readFileSync(path,'utf8');
 if(!src.includes(oldText))throw Error('Night range patch does not match '+path);
 writeFileSync(path,src.replace(oldText,newText));
}
// T8213 samples contain real detail below nominal video black. Keep those values
// in dashboard derivatives; HomeBase originals are never modified.
// This option changes decoding range only, not brightness/night detection.
change('src/eufy.ts', '"fps=8,scale=\'min(960,iw)\':-2"',
 'process.env.EUFY_PRESERVE_SHADOW_DETAIL === "true" ? "fps=8,scale=w=\'min(960,iw)\':h=-2:in_range=full:out_range=full" : "fps=8,scale=\'min(960,iw)\':-2"');
change('src/recording-media.ts',
 "if (codec === 'hevc' && !transcode) args.push('-tag:v', 'hvc1');",
 `if (codec === 'hevc' && !transcode) args.push('-tag:v', 'hvc1');
  if (process.env.EUFY_PRESERVE_SHADOW_DETAIL === 'true') {
    if (transcode) args.push('-vf', 'scale=in_range=full:out_range=tv', '-color_range', 'tv');
    else args.push('-bsf:v', codec === 'h264' ? 'h264_metadata=video_full_range_flag=1' : 'hevc_metadata=video_full_range_flag=1');
  }`);
