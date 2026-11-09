"""Build a standalone page with a hash-pinned script and no network permissions."""
from pathlib import Path
import hashlib
import base64

root = Path(__file__).parent
script = (root / 'vtech-parser.js').read_text() + r'''
const fileInput=document.getElementById('capture');
const status=document.getElementById('status');
const report=document.getElementById('report');
const clear=document.getElementById('clear');
fileInput.addEventListener('change',async()=>{
  report.value='';status.textContent='Reading on this device…';
  const file=fileInput.files[0];if(!file){status.textContent='No file selected.';return;}
  if(file.size>100*1024*1024){status.textContent='File too large. Use a short capture under 100 MB.';fileInput.value='';return;}
  try {
    const summary=VtechDiagnostic.analyze(await file.arrayBuffer());
    report.value=JSON.stringify(summary,null,2);
    status.textContent=summary.recognized?
      `Found ${summary.recognized} recognized local protocol packets. The summary below is ready to review.`:
      'No supported local handshake was found. You can share this summary; keep the original capture private.';
  } catch(e) {status.textContent='Could not inspect this capture. It may be truncated or use an unsupported format.';}
  fileInput.value='';
});
clear.addEventListener('click',()=>{report.value='';fileInput.value='';status.textContent='Report cleared. Close this tab to release the page.';});
document.getElementById('select').addEventListener('click',()=>{report.focus();report.select();});
'''
digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-DIGEST'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Private VTech diagnostic</title>
<style>
:root{color-scheme:dark;font:17px/1.5 system-ui,sans-serif;background:#0e1b2c;color:#e8eff7}
*{box-sizing:border-box}body{margin:0;padding:max(20px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left))}
main{max-width:760px;margin:auto}h1{font-size:1.8rem;line-height:1.2}h2{font-size:1.2rem}.badge{display:inline-block;background:#245d4b;border:1px solid #75bb9e;padding:5px 12px;border-radius:30px;font-size:.9rem}
.card{background:#192f46;border:1px solid #536d87;border-radius:18px;padding:20px;margin:20px 0}li{margin:.65em 0}p{margin:.7em 0}.muted{color:#b9c9da}
input,button,textarea{font:inherit;max-width:100%}input{display:block;margin-top:16px;width:100%;padding:12px;border:1px solid #7993ac;border-radius:10px;background:#233e58}
button{background:#285b4d;color:white;border:1px solid #7cb99f;padding:12px 18px;border-radius:10px;min-height:48px;cursor:pointer}button.secondary{background:#233e58;border-color:#7993ac}
textarea{display:block;width:100%;height:320px;border:1px solid #7993ac;background:#0e1b2c;color:#e8eff7;border-radius:10px;padding:12px;font:13px/1.5 monospace;resize:vertical;white-space:pre}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}#status{min-height:3em}label{font-weight:650}a{color:#a6d5ff}
</style></head><body><main>
<span class="badge">Runs on your device</span>
<h1>Private VTech diagnostic · v2</h1>
<p>Inspect a saved camera capture without uploading it. This page has no upload function, analytics, external scripts or storage. Its security policy blocks network connections.</p>
<section class="card"><h2>Keep the capture at home</h2><ol>
<li>Once this page is open, switch on <strong>airplane mode</strong> and turn <strong>Wi-Fi off</strong>.</li>
<li>Return here and choose your saved <strong>.pcap</strong> or <strong>.pcapng</strong> file.</li>
<li>Review the summary. It contains only packet counts, endpoint labels, message types and numeric protocol fields.</li>
<li>Copy <strong>only the summary</strong>, reconnect, and paste it into our chat. Keep the original capture on your phone.</li>
</ol><p class="muted">No camera QR, passwords, device identifiers, addresses, domains, filenames, raw packet contents or audio/video are included in the summary. This diagnostic does not connect to or change the camera.</p>
<label for="capture">Choose capture from this phone</label><input id="capture" type="file" accept=".pcap,.pcapng,.cap,application/vnd.tcpdump.pcap,application/octet-stream">
<p id="status" role="status" aria-live="polite">Ready. You can disconnect from the internet now.</p></section>
<section class="card"><h2>Summary to share</h2><textarea id="report" readonly aria-label="Redacted diagnostic summary" placeholder="Your summary will appear here."></textarea>
<div class="actions"><button id="select">Select summary</button><button id="clear" class="secondary">Clear summary</button></div>
<p class="muted">After selecting the summary, use your phone’s Copy action. Clearing removes the displayed report; closing the tab releases the page. Nothing is saved by this page.</p></section>
<p class="muted">Experimental diagnostic v2. Supports classic PCAP and PCAPNG enhanced packet blocks; Ethernet, raw IP and Linux cooked v1. Unsupported traffic is skipped. A missing handshake is not proof that the camera lacks a feature.</p>
</main><script>SCRIPT</script></body></html>'''
page=page.replace('DIGEST',digest).replace('SCRIPT',script)
(root/'vtech-local.html').write_text(page)
print('Built diagnostics/vtech-local.html')
