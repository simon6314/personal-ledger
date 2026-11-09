// 我的帳本 — 前端（後端為 Google 試算表 + Apps Script，見 Code.gs）
const API = 'https://script.google.com/macros/s/AKfycbylWxx8suN9zH5rOWbNbb5_z-4iTQT8P9Aowb_f3mldaQFwbHc78gArrcXswhAOLKP1/exec';
const TOKEN_KEY = 'personal_ledger_token';
const TYPE_ORDER = ['現金', '銀行', '信用卡', '其他'];

let current = currentSheetName();   // 目前檢視的月份，例如 "2026/11月"
let months = [];                    // 所有月份分頁
let accounts = [];                  // [{name, type}]
let all = [];                       // 全部紀錄（含 sheet、row、iso）
let editing = null;                 // 正在編輯的紀錄（新增時為 null）
let txType = '支出';                // 支出 / 收入 / 轉帳
let charts = {};                    // Chart.js 實例
let anaCategory = null;             // 分析頁目前展開的分類

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW');
const pad = n => String(n).padStart(2, '0');
const sum = (list, key) => list.reduce((a, r) => a + (Number(r[key]) || 0), 0);

// ── 日期與月份 ───────────────────────────────────────────────
function currentSheetName() { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}月`; }
function todayIso() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function sheetFromIso(iso) { const [y, m] = iso.split('-'); return `${y}/${parseInt(m, 10)}月`; }
function sheetOrder(s) { const m = s.match(/^(\d{4})\/(\d{1,2})/); return m ? Number(m[1]) * 100 + Number(m[2]) : 0; }
function isoYM(sheet) { const m = sheet.match(/^(\d{4})\/(\d{1,2})/); return `${m[1]}-${pad(m[2])}`; }
function lastDayIso(sheet) { const [y, m] = isoYM(sheet).split('-').map(Number); return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`; }
function monthRecords() { return all.filter(r => r.sheet === current); }
function typeOf(name) { const a = accounts.find(x => x.name === name); return (a && a.type) || '其他'; }

// 依 key 分組加總，依金額由大到小排序
function groupSum(list, keyFn, valKey) {
  const m = new Map();
  list.forEach(r => {
    const k = keyFn(r);
    m.set(k, (m.get(k) || 0) + (Number(r[valKey]) || 0));
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ── 存取碼（只存在這台裝置）────────────────────────────────────
function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
function saveToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) { /* 無法儲存時仍可用本次工作階段 */ } }
function forgetToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }

class AuthError extends Error {}

async function apiGet(params) {
  const qs = new URLSearchParams({ ...params, token: getToken() });
  const res = await fetch(`${API}?${qs}`);
  const d = await res.json();
  if (d.error === 'unauthorized') throw new AuthError();
  return d;
}

async function apiPost(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, token: getToken() })
  });
  const d = await res.json();
  if (d.error === 'unauthorized') throw new AuthError();
  if (d.error) throw new Error(d.message || d.error);
  return d;
}

// ── 載入資料 ────────────────────────────────────────────────
function setStatus(text, isErr) {
  const el = $('sync');
  el.textContent = text;
  el.classList.toggle('err', !!isErr);
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

function handleError(e) {
  if (e instanceof AuthError) {
    forgetToken();
    openTokenModal('存取碼不正確，請重新輸入');
    return;
  }
  setStatus('連線失敗', true);
  toast(e.message || '發生錯誤');
}

async function init() {
  if (!getToken()) return openTokenModal();
  try {
    await loadMonths();
    await loadAccounts();
    await loadAll();
  } catch (e) { handleError(e); }
}

function fillMonthSelect() {
  $('monthSel').innerHTML = months.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  $('monthSel').value = current;
}

async function loadMonths() {
  const d = await apiGet({ action: 'getSheets' });
  const set = new Set(d.sheets || []);
  set.add(currentSheetName());
  months = [...set].sort((a, b) => sheetOrder(b) - sheetOrder(a));
  fillMonthSelect();
}

async function loadAccounts() {
  const d = await apiGet({ action: 'getAccounts' });
  accounts = d.accounts || [];
  fillAccountSelects();
}

async function loadAll() {
  setStatus('同步中…');
  const d = await apiGet({ action: 'getAllRecords' });
  all = d.records || [];
  setStatus('已同步 · ' + new Date().toLocaleTimeString('zh-TW'));
  renderCurrentTab();
}

async function switchMonth(sheet) {
  current = sheet;
  if (!months.includes(sheet)) months = [sheet, ...months].sort((a, b) => sheetOrder(b) - sheetOrder(a));
  fillMonthSelect();
  renderCurrentTab();
}

// ── 分頁切換 ────────────────────────────────────────────────
let activeTab = 'records';
function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + name));
  // 月份選單只在明細與分析用到
  $('monthRow').classList.toggle('hidden', name === 'annual' || name === 'assets');
  renderCurrentTab();
}

function renderCurrentTab() {
  if (!all.length && activeTab !== 'records') return;
  if (activeTab === 'records') renderRecords();
  else if (activeTab === 'analysis') renderAnalysis();
  else if (activeTab === 'annual') renderAnnual();
  else if (activeTab === 'assets') renderAssets();
}

// ── 明細 ────────────────────────────────────────────────────
function renderRecords() {
  const recs = monthRecords();
  const inc = sum(recs, 'income');
  const exp = sum(recs, 'expense');
  $('sumIncome').textContent = money(inc);
  $('sumExpense').textContent = money(exp);
  $('sumBalance').textContent = money(inc - exp);
  $('sumTransfer').textContent = money(sum(recs, 'transfer'));
  renderList(recs);
}

function renderList(recs) {
  const el = $('list');
  if (!recs.length) { el.innerHTML = '<div class="empty">這個月還沒有紀錄</div>'; return; }
  const groups = {};
  recs.forEach(r => { (groups[r.iso] = groups[r.iso] || []).push(r); });
  const dates = Object.keys(groups).sort().reverse();
  el.innerHTML = dates.map(date => {
    const rows = groups[date].slice().sort((a, b) => b.row - a.row);
    return `<div class="date-head">${esc(date)}</div>` + rows.map(rowHtml).join('');
  }).join('');
}

function rowHtml(r) {
  const isT = r.type === '轉帳';
  const amt = isT ? r.transfer : (r.income ? r.income : r.expense);
  const cls = isT ? 'tr' : (r.income ? 'in' : 'out');
  const sign = isT ? '⇄' : (r.income ? '+' : '−');
  const sub = isT
    ? `${esc(r.account)} → ${esc(r.toAccount)}`
    : `${esc(r.account)}${r.category ? ' · ' + esc(r.category) : ''}`;
  const note = r.note ? ' · ' + esc(r.note) : '';
  return `<button class="rec" data-sheet="${esc(r.sheet)}" data-row="${r.row}">
    <div class="rec-main">
      <div class="rec-item">${esc(r.item)}</div>
      <div class="rec-sub">${sub}${note}</div>
    </div>
    <div class="rec-amt ${cls}">${sign} ${money(amt)}</div>
  </button>`;
}

function typeLabelOf(r) {
  if (r.type) return r.type;
  return r.transfer ? '轉帳' : (r.income ? '收入' : '支出');
}

// ── 分析：本月支出分類 ───────────────────────────────────────
function renderAnalysis() {
  $('anaTitle').textContent = `${current} 支出分類`;
  const exps = monthRecords().filter(r => r.expense > 0);
  const total = sum(exps, 'expense');
  $('anaTotal').textContent = money(total);
  const cats = groupSum(exps, r => r.category || '未分類', 'expense');
  const max = cats.length ? cats[0][1] : 0;
  $('anaCats').innerHTML = cats.length ? cats.map(([name, v]) => `
    <button class="bar-row${anaCategory === name ? ' active' : ''}" data-cat="${esc(name)}">
      <span class="bar-name">${esc(name)}</span>
      <span class="bar"><i style="width:${max ? (v / max * 100).toFixed(1) : 0}%"></i></span>
      <b>${money(v)}</b>
      <small>${total ? Math.round(v / total * 100) : 0}%</small>
    </button>`).join('') : '<div class="empty">這個月還沒有支出</div>';
  renderAnaDetail(exps);
}

function renderAnaDetail(exps) {
  if (!anaCategory) {
    $('anaDetailTitle').textContent = '分類明細';
    $('anaDetail').innerHTML = '<div class="empty">👆 點選上方分類，查看明細</div>';
    return;
  }
  const rows = exps.filter(r => (r.category || '未分類') === anaCategory);
  $('anaDetailTitle').textContent = `${anaCategory}（${rows.length} 筆）`;
  $('anaDetail').innerHTML = rows.length
    ? rows.sort((a, b) => (a.iso < b.iso ? 1 : -1)).map(rowHtml).join('')
    : '<div class="empty">沒有紀錄</div>';
}

// ── 年度 ────────────────────────────────────────────────────
function yearsAvailable() {
  const ys = new Set(all.map(r => Number(r.iso.slice(0, 4))));
  ys.add(new Date().getFullYear());
  return [...ys].sort((a, b) => b - a);
}

function renderAnnual() {
  const years = yearsAvailable();
  if (!$('yearSel').options.length) {
    $('yearSel').innerHTML = years.map(y => `<option value="${y}">${y} 年</option>`).join('');
    $('yearSel').value = String(new Date().getFullYear());
  }
  const year = Number($('yearSel').value);
  const yr = all.filter(r => r.iso.startsWith(year + '-'));
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const k = `${year}-${pad(i + 1)}`;
    const rs = yr.filter(r => r.iso.startsWith(k));
    return { m: i + 1, inc: sum(rs, 'income'), exp: sum(rs, 'expense') };
  });
  const inc = sum(yr, 'income');
  const exp = sum(yr, 'expense');
  $('yInc').textContent = money(inc);
  $('yExp').textContent = money(exp);
  $('yBal').textContent = money(inc - exp);
  $('yBal').className = (inc - exp) >= 0 ? 'in' : 'out';
  const passed = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
  $('yAvg').textContent = money(exp / Math.max(1, passed));

  drawChart('annualChart', {
    type: 'bar',
    data: {
      labels: monthly.map(x => x.m + '月'),
      datasets: [
        { label: '收入', data: monthly.map(x => x.inc), backgroundColor: '#46d39a' },
        { label: '支出', data: monthly.map(x => x.exp), backgroundColor: '#ff7b8c' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  const cats = groupSum(yr.filter(r => r.expense > 0), r => r.category || '未分類', 'expense');
  const max = cats.length ? cats[0][1] : 0;
  $('yCats').innerHTML = cats.length ? cats.map(([name, v]) => `
    <div class="bar-row static">
      <span class="bar-name">${esc(name)}</span>
      <span class="bar"><i style="width:${max ? (v / max * 100).toFixed(1) : 0}%"></i></span>
      <b>${money(v)}</b>
      <small>${exp ? Math.round(v / exp * 100) : 0}%</small>
    </div>`).join('') : '<div class="empty">這一年還沒有支出</div>';
}

// ── 財產 ────────────────────────────────────────────────────
// 依交易累加各帳戶餘額（只計到 asOfIso 為止）
function balancesAsOf(asOfIso) {
  const bal = {};
  accounts.forEach(a => { bal[a.name] = 0; });
  const add = (name, v) => { if (!name) return; bal[name] = (bal[name] || 0) + v; };
  all.forEach(r => {
    if (r.iso > asOfIso) return;
    if (r.type === '轉帳' || (r.transfer && !r.income && !r.expense)) {
      add(r.account, -(Number(r.transfer) || 0));
      add(r.toAccount, Number(r.transfer) || 0);
    } else if (r.income) add(r.account, Number(r.income) || 0);
    else if (r.expense) add(r.account, -(Number(r.expense) || 0));
  });
  return bal;
}

function renderAssets() {
  const today = todayIso();
  const bal = balancesAsOf(today);
  const names = Object.keys(bal);
  const net = names.reduce((s, n) => s + bal[n], 0);
  const bank = names.filter(n => ['現金', '銀行'].includes(typeOf(n))).reduce((s, n) => s + bal[n], 0);
  const card = names.filter(n => typeOf(n) === '信用卡').reduce((s, n) => s + bal[n], 0);
  $('aNet').textContent = money(net);
  $('aNet').className = net >= 0 ? 'in' : 'out';
  $('aBank').textContent = money(bank);
  $('aCard').textContent = money(card);
  $('aCard').className = card < 0 ? 'out' : '';

  $('aAccounts').innerHTML = TYPE_ORDER.map(t => {
    const items = names.filter(n => typeOf(n) === t).sort((a, b) => bal[b] - bal[a]);
    if (!items.length) return '';
    const subtotal = items.reduce((s, n) => s + bal[n], 0);
    return `<div class="acc-group">
      <div class="acc-group-head"><span>${t}</span><b>${money(subtotal)}</b></div>
      ${items.map(n => `<div class="acc-line"><span>${esc(n)}</span><b class="${bal[n] < 0 ? 'out' : ''}">${money(bal[n])}</b></div>`).join('')}
    </div>`;
  }).join('') || '<div class="empty">還沒有帳戶</div>';

  // 淨值走勢：每個月底的淨值（只到今天為止）
  const thisYM = today.slice(0, 7);
  const ascMonths = months.filter(m => isoYM(m) <= thisYM).sort((a, b) => sheetOrder(a) - sheetOrder(b));
  const series = ascMonths.map(m => {
    const asOf = isoYM(m) === thisYM ? today : lastDayIso(m);   // 當月只算到今天
    const b = balancesAsOf(asOf);
    return Object.values(b).reduce((s, v) => s + v, 0);
  });
  drawChart('netChart', {
    type: 'line',
    data: {
      labels: ascMonths.map(m => m.replace('/', '.').replace('月', '')),
      datasets: [{ label: '淨值', data: series, borderColor: '#5b6cf0', backgroundColor: 'rgba(91,108,240,.15)', fill: true, tension: .25, pointRadius: 2 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => Number(v).toLocaleString('zh-TW') } } } }
  });
}

// ── Chart.js 包裝（CDN 載入失敗時不影響其他功能）──────────────
function drawChart(id, config) {
  if (typeof Chart === 'undefined') return;
  const el = $(id);
  if (!el) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(el, config);
}

// ── 新增／編輯紀錄 ───────────────────────────────────────────
function setType(t) {
  txType = t;
  document.querySelectorAll('#recType button').forEach(b => b.classList.toggle('active', b.dataset.type === t));
  const isT = t === '轉帳';
  $('lblToAccount').classList.toggle('hidden', !isT);
  $('lblCategory').classList.toggle('hidden', isT);
  $('lblAccountText').textContent = isT ? '轉出帳戶' : '帳戶';
  $('recItem').placeholder = isT ? '轉帳可留空，會自動填「轉帳」' : '例如：午餐';
}

function accountOptionsHtml(selected) {
  const groups = TYPE_ORDER.map(t => {
    const items = accounts.filter(a => (a.type || '其他') === t);
    if (!items.length) return '';
    return `<optgroup label="${esc(t)}">${items.map(a =>
      `<option value="${esc(a.name)}"${a.name === selected ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`;
  }).join('');
  const known = new Set(accounts.map(a => a.name));
  const extra = selected && !known.has(selected)
    ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>` : '';
  return `<option value="">請選擇</option>${groups}${extra}`;
}

function fillAccountSelects(acc = {}) {
  $('recAccount').innerHTML = accountOptionsHtml(acc.account || '');
  $('recToAccount').innerHTML = accountOptionsHtml(acc.toAccount || '');
}

function openRecordModal(rec = null) {
  editing = rec;
  $('recTitle').textContent = rec ? '編輯紀錄' : '新增紀錄';
  $('recDelete').classList.toggle('hidden', !rec);
  setType(rec ? typeLabelOf(rec) : '支出');
  $('recDate').value = rec ? rec.iso : todayIso();
  $('recAmount').value = rec ? (rec.type === '轉帳' ? rec.transfer : (rec.income || rec.expense)) : '';
  $('recItem').value = rec ? rec.item : '';
  $('recCategory').value = rec ? rec.category : '';
  $('recNote').value = rec ? rec.note : '';
  fillAccountSelects(rec ? { account: rec.account, toAccount: rec.toAccount } : {});
  $('catList').innerHTML = [...new Set(all.map(r => r.category).filter(Boolean))]
    .map(c => `<option value="${esc(c)}"></option>`).join('');
  openModal('recModal');
}

async function saveRecord(e) {
  e.preventDefault();
  const date = $('recDate').value;
  const amount = Number($('recAmount').value);
  const account = $('recAccount').value;
  const toAccount = $('recToAccount').value;
  const isT = txType === '轉帳';
  let item = $('recItem').value.trim();
  if (isT && !item) item = '轉帳';

  if (!date) return toast('請選日期');
  if (!(amount > 0)) return toast('請輸入金額');
  if (!item) return toast('請輸入項目');
  if (!account) return toast(isT ? '請選轉出帳戶' : '請選帳戶');
  if (isT && (!toAccount || toAccount === account)) return toast('請選不同的轉入帳戶');

  const data = {
    date, item,
    income: txType === '收入' ? amount : 0,
    expense: txType === '支出' ? amount : 0,
    transfer: isT ? amount : 0,
    account,
    toAccount: isT ? toAccount : '',
    category: isT ? '' : $('recCategory').value.trim(),
    note: $('recNote').value.trim(),
    type: txType
  };

  const targetSheet = sheetFromIso(date);
  const btn = $('recSave');
  btn.disabled = true;
  try {
    if (editing && editing.sheet === targetSheet) {
      await apiPost({ action: 'updateRecord', sheet: editing.sheet, row: editing.row, data: { ...data, expectedItem: editing.item } });
    } else {
      // 換了月份：先刪舊列，再寫進新月份
      if (editing) await apiPost({ action: 'delete', sheet: editing.sheet, row: editing.row });
      await apiPost({ action: 'add', sheet: targetSheet, data });
    }
    closeModal('recModal');
    toast('已儲存 ✓');
    if (targetSheet !== current) await switchMonth(targetSheet);
    await loadAll();
  } catch (err) {
    handleError(err);
    if (!(err instanceof AuthError)) loadAll().catch(() => {});
  } finally {
    btn.disabled = false;
  }
}

async function deleteRecord() {
  if (!editing) return;
  if (!confirm(`確定刪除「${editing.item}」？`)) return;
  try {
    await apiPost({ action: 'delete', sheet: editing.sheet, row: editing.row });
    closeModal('recModal');
    toast('已刪除');
    await loadAll();
  } catch (err) { handleError(err); }
}

// ── 帳戶管理 ────────────────────────────────────────────────
function openSettings() {
  renderAccountList();
  openModal('setModal');
}

function renderAccountList() {
  const sorted = accounts.slice().sort((a, b) =>
    TYPE_ORDER.indexOf(a.type || '其他') - TYPE_ORDER.indexOf(b.type || '其他'));
  $('accList').innerHTML = sorted.map(a => `
    <div class="acc-row" data-name="${esc(a.name)}">
      <input class="acc-name" value="${esc(a.name)}" aria-label="帳戶名稱">
      <select class="acc-type" aria-label="類型">${TYPE_ORDER.map(t =>
        `<option value="${t}"${(a.type || '其他') === t ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <button class="btn sm" data-act="save" type="button">儲存</button>
      <button class="btn sm danger" data-act="del" type="button">刪</button>
    </div>`).join('') || '<p class="hint">還沒有帳戶</p>';
}

async function accountAction(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const row = btn.closest('.acc-row');
  const oldName = row.dataset.name;
  try {
    if (btn.dataset.act === 'save') {
      await apiPost({
        action: 'updateAccount', name: oldName,
        data: { name: row.querySelector('.acc-name').value.trim(), type: row.querySelector('.acc-type').value }
      });
      toast('已更新 ✓');
    } else {
      if (!confirm(`確定刪除帳戶「${oldName}」？`)) return;
      await apiPost({ action: 'deleteAccount', name: oldName });
      toast('已刪除');
    }
    await loadAccounts();
    await loadAll();
    renderAccountList();
  } catch (err) {
    if (err instanceof AuthError) return handleError(err);
    toast(err.message);
  }
}

async function addAccount(e) {
  e.preventDefault();
  const name = $('accNewName').value.trim();
  const type = $('accNewType').value;
  try {
    await apiPost({ action: 'addAccount', data: { name, type } });
    $('accNewName').value = '';
    toast('已新增 ✓');
    await loadAccounts();
    renderAccountList();
    renderCurrentTab();
  } catch (err) {
    if (err instanceof AuthError) return handleError(err);
    toast(err.message);
  }
}

// ── 彈窗 ────────────────────────────────────────────────────
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }

function openTokenModal(msg) {
  $('tokenErr').textContent = msg || '';
  $('tokenErr').classList.toggle('hidden', !msg);
  $('tokenInput').value = '';
  openModal('tokenModal');
  setTimeout(() => $('tokenInput').focus(), 50);
}

// ── 事件 ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('btnAdd').addEventListener('click', () => {
    if (!getToken()) return openTokenModal();
    openRecordModal(null);
  });
  $('btnSettings').addEventListener('click', openSettings);
  $('monthSel').addEventListener('change', e => switchMonth(e.target.value));
  $('yearSel').addEventListener('change', renderAnnual);
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  $('list').addEventListener('click', e => {
    const btn = e.target.closest('.rec');
    if (!btn) return;
    const rec = all.find(r => r.sheet === btn.dataset.sheet && String(r.row) === btn.dataset.row);
    if (rec) openRecordModal(rec);
  });
  $('anaCats').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    anaCategory = anaCategory === btn.dataset.cat ? null : btn.dataset.cat;
    renderAnalysis();
  });
  $('anaDetail').addEventListener('click', e => {
    const btn = e.target.closest('.rec');
    if (!btn) return;
    const rec = all.find(r => r.sheet === btn.dataset.sheet && String(r.row) === btn.dataset.row);
    if (rec) openRecordModal(rec);
  });

  $('recType').addEventListener('click', e => {
    const b = e.target.closest('button[data-type]');
    if (b) setType(b.dataset.type);
  });
  $('recForm').addEventListener('submit', saveRecord);
  $('recDelete').addEventListener('click', deleteRecord);
  $('accList').addEventListener('click', accountAction);
  $('accAddForm').addEventListener('submit', addAccount);
  $('btnForget').addEventListener('click', () => {
    if (!confirm('清除後需要重新輸入存取碼，確定？')) return;
    forgetToken();
    closeModal('setModal');
    openTokenModal('已清除，請重新輸入存取碼');
  });
  $('tokenForm').addEventListener('submit', async e => {
    e.preventDefault();
    const t = $('tokenInput').value.trim();
    if (!t) return;
    saveToken(t);
    closeModal('tokenModal');
    setStatus('同步中…');
    await init();
  });
  document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => closeModal(b.dataset.close)));
  document.querySelectorAll('.modal').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m && m.id !== 'tokenModal') closeModal(m.id); }));

  switchTab('records');
  init();
});
