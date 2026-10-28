import {readFileSync,writeFileSync} from 'node:fs';
const target='node_modules/@keesmod/eufy-mega-client/dist/vendor/p2p/session.js';
let source=readFileSync(target,'utf8');
// The vendored SDK is compiled CommonJS, unlike the enclosing ESM package.
const matches=[...source.matchAll(/^.*\.rootP2PLogger\.trace\(`Handle DATA \$\{[^}]+\} - CMD_VIDEO_FRAME`, \{/gm)];
if(matches.length!==1) throw new Error('Pinned packet boundary changed; refusing patch');
const marker=matches[0][0];
source='const {observeVideoPacket} = require("/app/packet-diagnostics.mjs");\n'+source.replace(marker,
'observeVideoPacket(this, message, videoMetaData, video_data, payloadStart, videoMetaData.aesKey !== "", !this.currentMessageState[message.dataType].p2pStreamFirstVideoDataReceived);\n'+marker);
writeFileSync(target,source);
