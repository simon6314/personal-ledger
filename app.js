// 我的帳本 — 前端（後端為 Google 試算表 + Apps Script，見 Code.gs）
const API = 'https://script.google.com/macros/s/AKfycbylWxx8suN9zH5rOWbNbb5_z-4iTQT8P9Aowb_f3mldaQFwbHc78gArrcXswhAOLKP1/exec';
const TOKEN_KEY = 'personal_ledger_token';
const TYPE_ORDER = ['現金', '銀行', '信用卡', '其他'];

let current = currentSheetName();   // 目前檢視的月份，例如 "2026/11月"
let months = [];                    // 所有月份分頁
let accounts = [];                  // [{name, type}]
let records = [];                   // 目前月份的紀錄
let editing = null;                 // 正在編輯的紀錄（新增時為 null）
let txType = '支出';                // 支出 / 收入 / 轉帳

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW');
const pad = n => String(n).padStart(2, '0');
const sum = (list, key) => list.reduce((a, r) => a + (Number(r[key]) || 0), 0);

// ── 日期與月份 ───────────────────────────────────────────────
function currentSheetName() { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}月`; }
function todayIso() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function sheetFromIso(iso) { const [y, m] = iso.split('-'); return `${y}/${parseInt(m, 10)}月`; }
function isoFromSheet(sheet, mmdd) {
  const m = sheet.match(/^(\d{4})\/(\d{1,2})/);
  const [mm, dd] = String(mmdd).split('/');
  return `${m[1]}-${pad(m[2])}-${pad(dd)}`;
}
function sheetOrder(s) { const m = s.match(/^(\d{4})\/(\d{1,2})/); return m ? Number(m[1]) * 100 + Number(m[2]) : 0; }

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
    await loadRecords();
  } catch (e) { handleError(e); }
}

async function loadMonths() {
  const d = await apiGet({ action: 'getSheets' });
  const set = new Set(d.sheets || []);
  set.add(currentSheetName());
  months = [...set].sort((a, b) => sheetOrder(b) - sheetOrder(a));
  $('monthSel').innerHTML = months.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  $('monthSel').value = current;
}

async function loadAccounts() {
  const d = await apiGet({ action: 'getAccounts' });
  accounts = d.accounts || [];
  fillAccountSelects();
}

async function loadRecords() {
  setStatus('同步中…');
  const d = await apiGet({ action: 'getAll', sheet: current });
  records = (d.records || []).map(r => ({ ...r, sheet: current, iso: isoFromSheet(current, r.date) }));
  setStatus('已同步 · ' + new Date().toLocaleTimeString('zh-TW'));
  render();
}

async function switchMonth(sheet) {
  current = sheet;
  if (!months.includes(sheet)) { months = [sheet, ...months].sort((a, b) => sheetOrder(b) - sheetOrder(a)); }
  $('monthSel').innerHTML = months.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  $('monthSel').value = current;
  try { await loadRecords(); } catch (e) { handleError(e); }
}

// ── 畫面 ────────────────────────────────────────────────────
function render() {
  renderSummary();
  renderList();
}

function renderSummary() {
  const inc = sum(records, 'income');
  const exp = sum(records, 'expense');
  const tr = sum(records, 'transfer');
  $('sumIncome').textContent = money(inc);
  $('sumExpense').textContent = money(exp);
  $('sumBalance').textContent = money(inc - exp);
  $('sumTransfer').textContent = money(tr);
}

function renderList() {
  const el = $('list');
  if (!records.length) { el.innerHTML = '<div class="empty">這個月還沒有紀錄</div>'; return; }
  const groups = {};
  records.forEach(r => { (groups[r.iso] = groups[r.iso] || []).push(r); });
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
  return `<button class="rec" data-row="${r.row}">
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

// ── 帳戶下拉選單（依類型分組）─────────────────────────────────
function accountOptionsHtml(selected) {
  const groups = TYPE_ORDER.map(t => {
    const items = accounts.filter(a => (a.type || '其他') === t);
    if (!items.length) return '';
    return `<optgroup label="${esc(t)}">${items.map(a =>
      `<option value="${esc(a.name)}"${a.name === selected ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`;
  }).join('');
  // 不在清單中的舊名稱也保留，避免編輯時被清掉
  const known = new Set(accounts.map(a => a.name));
  const extra = selected && !known.has(selected)
    ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>` : '';
  return `<option value="">請選擇</option>${groups}${extra}`;
}

function fillAccountSelects(acc = {}) {
  $('recAccount').innerHTML = accountOptionsHtml(acc.account || '');
  $('recToAccount').innerHTML = accountOptionsHtml(acc.toAccount || '');
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
  $('catList').innerHTML = [...new Set(records.map(r => r.category).filter(Boolean))]
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
    else await loadRecords();
  } catch (err) {
    handleError(err);
    if (!(err instanceof AuthError)) loadRecords().catch(() => {});
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
    await loadRecords();
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
    await loadRecords();
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
  $('list').addEventListener('click', e => {
    const btn = e.target.closest('.rec');
    if (!btn) return;
    const rec = records.find(r => String(r.row) === btn.dataset.row);
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

  init();
});
