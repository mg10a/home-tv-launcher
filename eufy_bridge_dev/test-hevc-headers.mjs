import assert from 'node:assert/strict';
import { HevcHeaderCounter } from './dist/live-transcoder.js';
const nal = (type, first = true) => Buffer.from([0,0,0,1,type << 1,1,first ? 128 : 0,42,43]);
const stream = Buffer.concat([nal(32),nal(33),nal(34),nal(19),nal(1,false),nal(1),Buffer.from([0,0,1,128,0,0])]);
const expected = { nals:6,slices:3,pictures:2,random_access:1,parameter_sets:3,invalid_headers:1 };
for (let size=1;size<=stream.length;size++) {
 const counter=new HevcHeaderCounter();
 for(let i=0;i<stream.length;i+=size) counter.consume(stream.subarray(i,i+size));
 assert.deepEqual(counter.counts,expected);
}
const empty=new HevcHeaderCounter();
empty.consume(Buffer.alloc(100000));
assert.equal(empty.counts.nals,0);
console.log('HEVC header counters pass every chunk boundary and ignore payload without headers');
