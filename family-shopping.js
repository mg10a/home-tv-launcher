/* Samsung Food shopping data stays in the authenticated Home Assistant connection. */
(function () {
'use strict';
const entity = 'sensor.samsung_food_shopping_list';
const defaultUrl = 'https://app.samsungfood.com/shopping-list';

function shoppingSnapshot(state, now = Date.now()) {
  const attributes = state?.attributes || {};
  const stamp = Date.parse(attributes.last_success || '');
  const valid = Array.isArray(attributes.items) && attributes.items.every(item =>
    item && typeof item.name === 'string' && item.name.trim() &&
    typeof item.quantity === 'string' && typeof item.completed === 'boolean');
  const items = valid ? attributes.items.map(item => ({
    name: item.name.slice(0, 500),
    quantity: item.quantity.slice(0, 300),
    completed: item.completed
  })) : [];
  const url = /^https:\/\/app\.samsungfood\.com\/shopping-list(?:\/[a-zA-Z0-9-]+)?$/.test(attributes.source_url || '')
    ? attributes.source_url : defaultUrl;
  return {
    name: typeof attributes.name === 'string' ? attributes.name.slice(0, 200) : '',
    items, url, stamp,
    hasSnapshot: valid && Number.isFinite(stamp),
    stale: !valid || state?.state !== 'ok' || !Number.isFinite(stamp) || now - stamp > 35 * 60000,
    status: state?.state || 'not_connected'
  };
}
if (typeof module !== 'undefined') module.exports = {shoppingSnapshot};
if (typeof document === 'undefined') return;
const root = document.getElementById('familyShoppingPanel');
if (!root) return;
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const dialog = element('dialog', undefined, 'samsung-shopping-dialog');
dialog.setAttribute('aria-label', 'Samsung Food shopping list');
const header = element('header');
const title = element('h2', 'Samsung Food shopping');
const close = element('button', 'Close');
close.type = 'button';
close.onclick = () => dialog.close();
header.append(title, close);
const body = element('section');
dialog.append(header, body);
document.body.append(dialog);

function getData() {
  const connected = typeof haVerified !== 'undefined' && haVerified &&
    typeof haSocket !== 'undefined' && haSocket?.readyState === 1;
  const state = typeof haStates !== 'undefined' ? haStates[entity] : null;
  return {connected, state, data: shoppingSnapshot(state)};
}
function openList() {
  render();
  if (!dialog.open) dialog.showModal();
  close.focus();
}
function renderList(host, expanded, current) {
  const {connected, state, data} = current;
  host.replaceChildren();
  const tools = element('div', undefined, 'samsung-shopping-tools');
  const open = element('a', 'Open in Samsung Food');
  open.href = data.url;
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  tools.append(open);
  if (!expanded) {
    const expand = element('button', 'View list');
    expand.type = 'button';
    expand.onclick = openList;
    tools.append(expand);
  }
  host.append(tools);
  if (!connected || !state || !data.hasSnapshot) {
    host.append(element('p', !connected ? 'Connect Home Assistant to show your shopping list.' :
      data.status === 'login_required' ? 'Samsung Food needs sign-in.' :
      data.status === 'read_failed' ? 'Shopping sync needs attention.' :
      'Waiting for the first Samsung Food shopping sync.', 'samsung-shopping-status'));
    return;
  }
  const remaining = data.items.filter(item => !item.completed);
  host.append(element('strong', (data.name || 'Shopping list') + ' · ' + remaining.length + ' to buy',
    'samsung-shopping-summary'));
  const stamp = new Date(data.stamp).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
  });
  host.append(element('p', (data.stale ? 'Sync needs attention · last read ' : 'Synced ') + stamp,
    'samsung-shopping-status' + (data.stale ? ' is-stale' : '')));
  const list = element('ul', undefined, 'samsung-shopping-items');
  const shown = expanded ? [...remaining, ...data.items.filter(item => item.completed)] : remaining;
  for (const item of shown) {
    const row = element('li', undefined, item.completed ? 'is-completed' : '');
    row.append(element('span', (item.completed ? '✓ ' : '') + item.name));
    if (item.quantity) row.append(element('small', item.quantity));
    list.append(row);
  }
  if (!shown.length) list.append(element('li', 'Nothing left to buy.'));
  host.append(list);
  if (expanded) host.append(element('p',
    'Add or tick off items in Samsung Food. Changes sync every 15 minutes. Use Checkout there to choose your retailer.',
    'samsung-shopping-help'));
}
let previous = '';
function render() {
  const current = getData();
  const signature = JSON.stringify({connected: current.connected, present: !!current.state, data: current.data});
  if (signature === previous) return;
  previous = signature;
  renderList(root, false, current);
  renderList(body, true, current);
}
const style = element('style');
style.textContent = `
#familyShoppingPanel:not([hidden]){display:flex;flex-direction:column;gap:5px;min-height:0;overflow:hidden}
#familyShoppingPanel[hidden],#familyTodoPanel[hidden]{display:none!important}
.samsung-shopping-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:none}
.samsung-shopping-tools a,.samsung-shopping-tools button,.samsung-shopping-dialog button{
  background:#233b55;color:#edf5ff;border:1px solid #637e99;border-radius:8px;padding:6px 8px;
  font:inherit;text-decoration:none;cursor:pointer}
#familyShoppingPanel .samsung-shopping-tools{font-size:11px}
.samsung-shopping-summary{font-size:12px;flex:none}
.samsung-shopping-status{font-size:11px;line-height:1.3;margin:0;color:#bed0e4;flex:none}
.samsung-shopping-status.is-stale{color:#ffd18b}
.samsung-shopping-items{list-style:none;margin:0;padding:0;overflow:auto;min-height:0;flex:1}
.samsung-shopping-items li{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
  padding:5px 2px;border-bottom:1px solid #3c526a;font-size:12px;line-height:1.35}
.samsung-shopping-items li span{overflow-wrap:anywhere}
.samsung-shopping-items small{color:#bed0e4;text-align:right;flex:0 0 auto;max-width:45%;font-size:11px}
.samsung-shopping-items .is-completed{opacity:.65;text-decoration:line-through}
.samsung-shopping-dialog{box-sizing:border-box;width:min(760px,94vw);height:85dvh;max-height:900px;
  background:#172b3e;color:#e9f1ff;border:1px solid #617a94;border-radius:18px;padding:18px}
.samsung-shopping-dialog[open]{display:flex;flex-direction:column;gap:12px}
.samsung-shopping-dialog::backdrop{background:#050b17cc}
.samsung-shopping-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px}
.samsung-shopping-dialog h2{font-size:22px;margin:0}
.samsung-shopping-dialog section{display:flex;flex-direction:column;gap:8px;min-height:0;flex:1}
.samsung-shopping-dialog .samsung-shopping-items li{font-size:15px;padding:8px 2px}
.samsung-shopping-dialog .samsung-shopping-items small{font-size:13px}
.samsung-shopping-help{font-size:12px;color:#bed0e4;line-height:1.4;margin:0}
`;
document.head.append(style);
window.addEventListener('home-states-updated', render);
document.addEventListener('visibilitychange', () => {if (!document.hidden) render();});
setInterval(() => {if (!document.hidden) render();}, 60000);
render();
})();
