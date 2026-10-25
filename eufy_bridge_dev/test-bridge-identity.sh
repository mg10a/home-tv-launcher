#!/bin/sh
# Run inside the *built* DEV add-on container. Confirm its actual HTTP state
# presents an isolated bridge ID, stable over restart and distinct from raw
# UUID used for persistent Eufy migration. Never log real user identifiers.
set -eu
mkdir -p /data
printf '%s\n' '{"token":"ci-not-a-real-bridge-token-1234567890123456789","diagnostics":false}' >/data/options.json
start() {
 node /app/bootstrap.mjs >/tmp/eufy-ci-bootstrap.log 2>&1 &
 pid=$!
}
check() {
 node --input-type=module <<'EOF'
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
let state;
for(let attempt=0;attempt<60;attempt++){
 try{
  const response=await fetch('http://127.0.0.1:8064/v1/state',{
   headers:{Authorization:'Bearer ci-not-a-real-bridge-token-1234567890123456789'},
   signal:AbortSignal.timeout(1000),
  });
  assert.equal(response.status,200);
  state=await response.json();break;
 }catch(e){await new Promise(r=>setTimeout(r,100))}
}
assert.ok(state, 'DEV bridge must serve authenticated HTTP state on 8064');
assert.equal(state.protocol,1);
const stored=readFileSync('/data/eufy/bridge-id','utf8');
assert.match(stored,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
assert.equal(state.bridge_id,'home-tv-dev-'+stored,
 'DEV must expose a distinct HA config entry without altering raw saved UUID');
if(existsSync('/tmp/dev-bridge-id-before')){
 assert.equal(state.bridge_id,readFileSync('/tmp/dev-bridge-id-before','utf8'),
 'DEV integration identity must survive process restart');
}else{
 writeFileSync('/tmp/dev-bridge-id-before',state.bridge_id);
}
console.log('PASS: isolated DEV bridge identity served by real add-on on port 8064');
EOF
}
stop() {
 kill -TERM "$pid"
 wait "$pid" || true
}
start
check
stop
start
check
stop
echo 'PASS: actual DEV bridge identity is unique to DEV namespace and persistent across restart'
