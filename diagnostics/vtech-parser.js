/* Local, allowlisted protocol summary. No networking, persistence, or media decoding. */
(function(root) {
  'use strict';
  const key = new TextEncoder().encode('Charlie is the d');
  const rol = (x,n) => ((x << n) | (x >>> (32-n))) >>> 0;
  function permute(b) {
    const [b0,b1,b2,b3]=b;
    const t=((b0>>>16&255)|(b0&0xff00)|(b0<<24))>>>0;
    const u=((b1>>>16&255)|(b1>>>8&0xff0000)|(b1<<8&0xffff)|(b0&0xff000000))>>>0;
    return [((b2>>>24)<<29)|(((b2&0xff00)|((b2&255)<<16)|(b2>>>24)|(b3&0xff000000))>>>3),
      ((b3>>>8)<<25)|(((b3>>>8&255)|(b2>>>8&0xff00)|((b3&255)<<16)|((b3&0xff0000)<<8))>>>7),
      (t<<21)|((t|(b1<<8&0xff0000))>>>11),rol(u,17)].map(x=>x>>>0);
  }
  const inverse=new Uint8Array(128);
  for(let i=0;i<128;i++) {
    const b=[0,0,0,0]; b[i>>>5]=2**(i%32);
    const y=permute(b);
    for(let j=0;j<128;j++) if((y[j>>>5]>>>(j%32))&1) inverse[j]=i;
  }
  function unscramble(bytes) {
    const a=bytes.slice(), d=new DataView(a.buffer), k=new DataView(key.buffer);
    let at=0;
    for(;at+16<=a.length;at+=16) {
      const y=[0,4,8,12].map(n=>d.getUint32(at+n,true)), b=[0,0,0,0];
      for(let j=0;j<128;j++) if((y[j>>>5]>>>(j%32))&1) {
        const s=inverse[j]; b[s>>>5]|=1<<(s%32);
      }
      b.forEach((v,i)=>d.setUint32(at+i*4,rol(v^k.getUint32(i*4,true),[1,5,9,13][i]),true));
    }
    const n=a.length-at, order=({2:[1,0],4:[2,3,0,1],8:[7,4,3,2,1,6,5,0]})[n];
    const tail=a.slice(at), tmp=new Uint8Array(n);
    for(let i=0;i<n;i++) tmp[order?order[i]:i]=tail[i];
    for(let i=0;i<n;i++) a[at+i]=tmp[i]^key[i];
    return a;
  }
  const u16=(a,n)=>a[n]|a[n+1]<<8;
  const be16=(a,n)=>a[n]<<8|a[n+1];
  const names={0x601:'discovery probe',0x602:'discovery reply',0x402:'session request',
    0x404:'session response',0x407:'channel data out',0x408:'channel data in',
    0x417:'close out',0x418:'close in',0x427:'keepalive out',0x428:'keepalive in'};
  function header(payload) {
    if(payload.length<16 || payload.length>2048) return null;
    if(u16(payload,0)===0xcc51) return {type:'connect record'};
    let h=payload.subarray(0,16), scrambled=false;
    if(u16(h,0)!==0x204) { h=unscramble(h); scrambled=true; }
    if(u16(h,0)!==0x204 || !names[u16(h,8)]) return null;
    const body=u16(h,4);
    if(body+16!==payload.length) return null;
    const op=u16(h,8);
    const result={type:names[op],opcode:'0x'+op.toString(16),version:h[2],
      flags:h[3],bytes:payload.length,wire:scrambled?'scrambled':'plain'};
    if(op===0x602) {
      result.replyForm=body>=0xb8?'long':body>=0x24?'short':'unrecognized';
      if(result.replyForm==='long' && payload.length>0xc4) {
        // Partial scrambling leaves this offset unchanged. Never export body bytes.
        const p=scrambled && !(h[3]&1)?unscramble(payload):payload;
        result.replyResult=p[0xc4];
      }
    }
    return result;
  }
  function network(packet,link) {
    let at=0, type=0;
    if(link===1) { if(packet.length<14)return null; type=be16(packet,12); at=14;
      for(let i=0;i<2 && (type===0x8100||type===0x88a8);i++) {
        if(packet.length<at+4)return null; type=be16(packet,at+2); at+=4;
      }
    } else if(link===101||link===228||link===229) {type=(packet[0]>>>4)===4?0x800:0x86dd;}
    else if(link===113) {if(packet.length<16)return null;type=be16(packet,14);at=16;}
    else return null;
    let end, src, dst;
    if(type===0x800) {
      if(packet.length<at+20 || packet[at]>>>4!==4)return null;
      const ihl=(packet[at]&15)*4, total=be16(packet,at+2);
      if(ihl<20||total<ihl+8||packet.length<at+total||packet[at+9]!==17||(be16(packet,at+6)&0x3fff))return null;
      const priv=o=>packet[o]===10||(packet[o]===172&&packet[o+1]>=16&&packet[o+1]<=31)||(packet[o]===192&&packet[o+1]===168);
      if(!priv(at+12)||!priv(at+16))return null;
      src=Array.from(packet.subarray(at+12,at+16)).join('.'); dst=Array.from(packet.subarray(at+16,at+20)).join('.');
      end=at+total;at+=ihl;
    } else if(type===0x86dd) {
      if(packet.length<at+48||packet[at]>>>4!==6||packet[at+6]!==17)return null;
      const priv=o=>(packet[o]&0xfe)===0xfc||(packet[o]===0xfe&&(packet[o+1]&0xc0)===0x80);
      if(!priv(at+8)||!priv(at+24))return null;
      src=Array.from(packet.subarray(at+8,at+24)).join('.');dst=Array.from(packet.subarray(at+24,at+40)).join('.');
      end=at+40+be16(packet,at+4);if(end>packet.length)return null;at+=40;
    } else return null;
    if(at+8>end)return null;
    const len=be16(packet,at+4);if(len<8||at+len>end)return null;
    // Addresses are used only transiently to assign endpoint letters, never returned.
    return {src,dst,payload:packet.subarray(at+8,at+len)};
  }
  function analyze(buffer) {
    if(buffer.byteLength>100*1024*1024)throw Error('Capture is too large. Use a capture shorter than 10 seconds.');
    const a=new Uint8Array(buffer), d=new DataView(buffer);
    if(a.length<12)throw Error('This is not a complete PCAP file.');
    const groups=new Map(), endpoint=new Map();let packets=0,localUDP=0,recognized=0,skippedLink=0;
    const firstHandshake=[];
    const label=ip=>{if(!endpoint.has(ip))endpoint.set(ip,'Endpoint '+(endpoint.size+1));return endpoint.get(ip);};
    function packet(bytes,link) {
      packets++;
      if(![1,101,113,228,229].includes(link)){skippedLink++;return;}
      const n=network(bytes,link);if(!n)return;localUDP++;
      const h=header(n.payload);if(!h)return;recognized++;
      const v={from:label(n.src),to:label(n.dst),...h};
      const id=JSON.stringify(v); if(!groups.has(id)&&groups.size>=256)return;
      groups.set(id,(groups.get(id)||0)+1);
      if(!['channel data out','channel data in','keepalive out','keepalive in'].includes(h.type)&&firstHandshake.length<60)firstHandshake.push(v);
    }
    let format;
    const magic=d.getUint32(0,false);
    if([0xa1b2c3d4,0xd4c3b2a1,0xa1b23c4d,0x4d3cb2a1].includes(magic)) {
      format='PCAP';if(a.length<24)throw Error('Incomplete PCAP header.');
      const le=[0xd4c3b2a1,0x4d3cb2a1].includes(magic), link=d.getUint32(20,le)&0xffff;
      for(let at=24;at<a.length;) {
        if(at+16>a.length)throw Error('Truncated PCAP record.');
        const n=d.getUint32(at+8,le);if(n>a.length-at-16)throw Error('Truncated PCAP packet.');
        packet(a.subarray(at+16,at+16+n),link);at+=16+n;
      }
    } else if(magic===0x0a0d0d0a) {
      format='PCAPNG';let le=true, interfaces=[];
      for(let at=0;at<a.length;) {
        if(at+12>a.length)throw Error('Truncated PCAPNG block.');
        if(d.getUint32(at,false)===0x0a0d0d0a) {
          const bom=d.getUint32(at+8,false);if(![0x1a2b3c4d,0x4d3c2b1a].includes(bom))throw Error('Invalid PCAPNG byte order.');
          le=bom===0x4d3c2b1a; interfaces=[];
        }
        const type=d.getUint32(at,le),n=d.getUint32(at+4,le);
        if(n<12||n%4||n>a.length-at||d.getUint32(at+n-4,le)!==n)throw Error('Invalid PCAPNG block length.');
        if(type===1) {if(n<20)throw Error('Invalid interface block.');interfaces.push(d.getUint16(at+8,le));}
        if(type===6) {
          if(n<32)throw Error('Invalid packet block.');
          const idx=d.getUint32(at+8,le),cap=d.getUint32(at+20,le);
          if(cap>n-32||interfaces[idx]===undefined)throw Error('Invalid captured packet.');
          packet(a.subarray(at+28,at+28+cap),interfaces[idx]);
        }
        at+=n;
      }
    } else throw Error('Choose a PCAP or PCAPNG capture, not a screenshot or ZIP.');
    return {diagnostic:'VTech local handshake summary v1',format,packets,localUDP,recognized,skippedLink,
      limitation:'Only recognized IOTC headers in private-to-private UDP traffic. No media, credentials, addresses, domains, timestamps, ports, filenames or raw bytes included. Missing packets or unknown formats do not prove absence of a protocol.',
      groups:Array.from(groups,([v,count])=>({...JSON.parse(v),count})),firstHandshake};
  }
  const api={analyze};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.VtechDiagnostic=api;
})(globalThis);
