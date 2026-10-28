import {readFileSync,writeFileSync} from 'node:fs';
const target='node_modules/@keesmod/eufy-mega-client/dist/vendor/p2p/session.js';
let source=readFileSync(target,'utf8');
const marker='rootP2PLogger.trace(`Handle DATA ${P2PDataType[message.dataType]} - CMD_VIDEO_FRAME`, {';
if(source.split(marker).length!==2) throw new Error('Pinned packet boundary changed; refusing patch');
source="import {observeVideoPacket} from '/app/packet-diagnostics.mjs';\n"+source.replace(marker,
'observeVideoPacket(this, message, videoMetaData, video_data, payloadStart, videoMetaData.aesKey !== "", !this.currentMessageState[message.dataType].p2pStreamFirstVideoDataReceived);\n'+marker);
writeFileSync(target,source);
