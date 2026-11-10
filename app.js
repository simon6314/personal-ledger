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
let lastOpened = null;              // 最近開啟的紀錄（供「複製」使用）
let lastSyncText = '';              // 最近一次同步的狀態文字
let monthCache = [];                // 目前月份的紀錄（先載入，很快顯示）
let allLoaded = false;              // 全部月份是否已在背景載入完成
let monthSeq = 0, fullSeq = 0;      // 用來丟棄過期的回應

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
function pool() { return allLoaded ? all : monthCache; }
function monthRecords() { return pool().filter(r => r.sheet === current); }
// 把後端回傳的紀錄統一補上正確的 iso（YYYY-MM-DD）；舊快取或後端 iso 錯誤時以此修正
function fixRecords(list) {
  return (list || []).map(r => (r.sheet && r.date) ? { ...r, iso: isoFromDate(r.sheet, r.date) } : r);
}
function isoFromDate(sheet, mmdd) {
  const m = sheet.match(/^(\d{4})\/(\d{1,2})/);
  const [mm, dd] = String(mmdd).split('/');
  return `${m[1]}-${pad(m[2])}-${pad(dd)}`;
}
function typeOf(name) { const a = accounts.find(x => x.name === name); return (a && a.type) || '其他'; }

// 依 key 分組加總，依金額由大到小排序
// ── 分類圖示（只影響顯示，資料仍是純文字分類名稱）─────────────────
const CAT_ICON = {
  '食物': '🍜', '超市&賣場': '🛒', '網購': '📦', '交通': '🚌', '紅利': '⭐', '回饋': '💸',
  '存款利息': '🏦', '薪金': '💰', '薪水': '💰', '津貼': '💵', '零用錢': '👛', '禮物': '🎁', '社交': '🥂',
  '文化': '🎨', '健康': '🌿', '醫療': '💊', '保險': '🛡️', '美容': '💄', '服飾': '👗',
  '家居': '🪑', '老家': '🏠', '新家': '🔑', '房子': '🏡', '租金': '🏘️', '稅費': '🏛️',
  '手續費': '🪙', '旅遊': '✈️', '表演藝術': '🎭', '訂閱': '📺', '網路': '📶', '教育': '📚', '樂透': '🎰', '電費': '⚡', '其他': '🫧', '未分類': '📌'
};
function catText(name) {
  if (!name) return '';
  const base = String(name).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '').trim();
  const icon = CAT_ICON[base];
  return icon ? icon + ' ' + base : base;
}

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
function forgetToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } clearCache(); }

// ── 本機快取（只存在這台裝置，清除存取碼時一併清除）──────────────
const CACHE_KEY = 'personal_ledger_cache_v1';
function saveCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, ts: Date.now(), months, accounts, all })); }
  catch (e) { /* 空間不足或無法使用時略過，不影響正常運作 */ }
}
function loadCache() {
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c && c.v === 1 ? c : null; }
  catch (e) { return null; }
}
function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ } }

class AuthError extends Error {}

// 後端錯誤要明確顯示，避免把錯誤當成「沒有資料」
function apiErrorMessage(d) {
  if (d.error === 'bad action') return '後端版本過舊，請到 Apps Script 重新部署新版本';
  return d.message || d.error;
}

async function apiGet(params) {
  const qs = new URLSearchParams({ ...params, token: getToken() });
  const res = await fetch(`${API}?${qs}`);
  const d = await res.json();
  if (d.error === 'unauthorized') throw new AuthError();
  if (d.error) throw new Error(apiErrorMessage(d));
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
  if (d.error) throw new Error(apiErrorMessage(d));
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
  // 先用快取立即顯示，再到網路上更新
  const c = loadCache();
  if (c) {
    months = Array.isArray(c.months) ? c.months : [];
    accounts = Array.isArray(c.accounts) ? c.accounts : [];
    all = Array.isArray(c.all) ? fixRecords(c.all) : [];
    allLoaded = Array.isArray(c.all);
    if (months.length) fillMonthSelect();
    fillAccountSelects();
    lastSyncText = '快取 · ' + new Date(c.ts).toLocaleString('zh-TW');
    setStatus(lastSyncText + '（更新中…）');
    renderCurrentTab();
  }
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
  saveCache();
}

async function loadAccounts() {
  const d = await apiGet({ action: 'getAccounts' });
  accounts = d.accounts || [];
  fillAccountSelects();
  saveCache();
}

// 先載入目前月份（很快就能看到明細），再於背景載入全部月份（統計用）
async function loadAll() {
  await loadMonthCache();
  loadFull();
}

async function loadMonthCache() {
  const seq = ++monthSeq;
  setStatus(`載入 ${current} 中…`);
  const d = await apiGet({ action: 'getAll', sheet: current });
  if (seq !== monthSeq) return;
  monthCache = (d.records || []).map(r => ({ ...r, sheet: current, iso: isoFromDate(current, r.date) }));
  setStatus(allLoaded ? lastSyncText : '本月已載入，其他月份背景載入中…');
  renderCurrentTab();
}

async function loadFull() {
  const seq = ++fullSeq;
  setStatus(allLoaded ? lastSyncText : '本月已載入，其他月份背景載入中…');
  try {
    const d = await apiGet({ action: 'getAllRecords' });
    if (seq !== fullSeq) return;
    all = fixRecords(d.records);
    allLoaded = true;
    lastSyncText = '已同步 · ' + new Date().toLocaleTimeString('zh-TW');
    setStatus(lastSyncText);
    saveCache();
    renderCurrentTab();
  } catch (e) { handleError(e); }
}

async function switchMonth(sheet) {
  current = sheet;
  if (!months.includes(sheet)) months = [sheet, ...months].sort((a, b) => sheetOrder(b) - sheetOrder(a));
  fillMonthSelect();
  if (allLoaded) renderCurrentTab();
  else {
    try { await loadMonthCache(); } catch (e) { handleError(e); }
  }
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

const LOADING_TARGET = { annual: 'yCats', assets: 'aAccounts' };
function renderCurrentTab() {
  if (activeTab === 'records') return renderRecords();
  if (activeTab === 'analysis') return renderAnalysis();   // 只用本月資料，不需等全部載入
  if (!allLoaded) {
    const id = LOADING_TARGET[activeTab];
    if (id) $(id).innerHTML = '<div class="empty">其他月份背景載入中，稍候會自動顯示…</div>';
    return;
  }
  if (activeTab === 'annual') renderAnnual();
  else if (activeTab === 'assets') renderAssets();
}

// ── 明細 ────────────────────────────────────────────────────
// 股息轉帳與同一天、同一帳戶的 Fees 手續費合併成一列顯示（只影響畫面，資料不變）
function mergeDividendFees(list) {
  const isFee = r => r.item === 'Fees' && Number(r.expense) > 0 && !r.transfer && !r.income;
  const isDiv = r => r.type === '轉帳' && /股息/.test(r.item || '');
  const divs = {};
  list.forEach(r => { if (isDiv(r)) (divs[r.iso + '|' + r.account] = divs[r.iso + '|' + r.account] || []).push(r); });
  const out = [];
  const used = new Set();
  const merged = {};
  list.forEach(r => {
    if (isFee(r)) {
      const bucket = divs[r.iso + '|' + r.account] || [];
      const target = bucket.find(d => !used.has(d.sheet + ':' + d.row));
      if (target) {
        used.add(target.sheet + ':' + target.row);
        merged[target.sheet + ':' + target.row] = (merged[target.sheet + ':' + target.row] || 0) + Number(r.expense);
        return;                       // 這筆手續費併入股息，不另外列出
      }
    }
    out.push(r);
  });
  return out.map(r => merged[r.sheet + ':' + r.row] ? { ...r, fee: merged[r.sheet + ':' + r.row] } : r);
}

function renderRecords() {
  const q = $('searchInput') ? $('searchInput').value.trim().toLowerCase() : '';
  if (q) return renderSearch(q);
  setStatus(allLoaded ? lastSyncText : '本月已載入，其他月份背景載入中…');   // 離開搜尋時還原狀態列
  const recs = monthRecords();
  summarySet = recs;
  const inc = sum(recs, 'income');
  const exp = sum(recs, 'expense');
  $('sumIncome').textContent = money(inc);
  $('sumExpense').textContent = money(exp);
  $('sumBalance').textContent = money(inc - exp);
  $('sumTransfer').textContent = money(sum(recs, 'transfer'));
  renderList(mergeDividendFees(recs));
}

// 點收入／支出卡片：顯示目前畫面範圍內的統計（月份或搜尋結果）
let summarySet = [];
let statKind = 'expense';   // 統計彈窗目前的種類
let statCat = null;         // 統計彈窗目前展開的分類
function openStatModal(kind) {
  if (kind !== statKind) statCat = null;
  const isInc = kind === 'income';
  const key = isInc ? 'income' : 'expense';
  const list = summarySet.filter(r => r[key] > 0);
  const total = sum(list, key);
  const count = list.length;
  const avg = count ? total / count : 0;
  const biggest = list.reduce((b, r) => (!b || r[key] > b[key] ? r : b), null);
  const cats = groupSum(list, r => r.category || '未分類', key);
  const max = cats.length ? cats[0][1] : 0;
  statKind = key;
  $('statTitle').textContent = `${isInc ? '💚 收入' : '🧾 支出'}統計`;
  $('statSum').innerHTML = `
    <div class="acc-sum-grid">
      <div><span>總額</span><b class="${isInc ? 'in' : 'out'}">${money(total)}</b></div>
      <div><span>筆數</span><b>${count}</b></div>
      <div><span>平均每筆</span><b>${money(Math.round(avg))}</b></div>
      <div><span>最大一筆</span><b>${biggest ? money(biggest[key]) : '-'}</b></div>
    </div>
    ${biggest ? `<p class="hint">最大一筆：${esc(biggest.item)}（${esc(biggest.iso)}）</p>` : ''}`;
  $('statList').innerHTML = cats.length ? cats.map(([name, v]) => {
    const open = statCat === name;
    return `
    <div class="bar-row toggle${open ? ' active' : ''}" data-cat="${esc(name)}">
      <span class="bar-name">${open ? '▾' : '▸'} ${esc(catText(name))}</span>
      <span class="bar"><i style="width:${max ? (v / max * 100).toFixed(1) : 0}%"></i></span>
      <b>${money(v)}</b>
      <small>${total ? Math.round(v / total * 100) : 0}%</small>
    </div>${open ? catDetailHtml(list, name, key) : ''}`;
  }).join('') : '<div class="empty">這個範圍內沒有' + (isInc ? '收入' : '支出') + '</div>';
  openModal('statModal');
}

// 搜尋：跨所有月份，比對項目、分類、帳戶、轉入帳戶、備註、類型與金額
function renderSearch(q) {
  const hits = pool().filter(r => [r.item, r.category, r.account, r.toAccount, r.note, r.type,
    String(r.income || ''), String(r.expense || ''), String(r.transfer || '')]
    .join(' ').toLowerCase().includes(q));
  summarySet = hits;
  const inc = sum(hits, 'income');
  const exp = sum(hits, 'expense');
  $('sumIncome').textContent = money(inc);
  $('sumExpense').textContent = money(exp);
  $('sumBalance').textContent = money(inc - exp);
  $('sumTransfer').textContent = money(sum(hits, 'transfer'));
  const shown = hits.slice().sort((a, b) => (a.iso < b.iso ? 1 : -1)).slice(0, 300);
  setStatus(`搜尋「${q}」：共 ${hits.length} 筆${hits.length > shown.length ? `（顯示前 ${shown.length} 筆）` : ''}${allLoaded ? '' : '（僅本月，其他月份載入中）'}`);
  renderList(shown, '找不到符合的紀錄');
}

function renderList(recs, emptyText = '這個月還沒有紀錄') {
  const el = $('list');
  if (!recs.length) { el.innerHTML = `<div class="empty">${emptyText}</div>`; return; }
  const groups = {};
  recs.forEach(r => { (groups[r.iso] = groups[r.iso] || []).push(r); });
  const dates = Object.keys(groups).sort().reverse();
  el.innerHTML = dates.map(date => {
    const rows = groups[date].slice().sort((a, b) => b.row - a.row);
    return `<div class="date-head">${esc(date)}</div>` + rows.map(r => rowHtml(r, true)).join('');
  }).join('');
}

function rowHtml(r, withDate) {
  const isT = r.type === '轉帳';
  const amt = isT ? r.transfer : (r.income ? r.income : r.expense);
  const cls = isT ? 'tr' : (r.income ? 'in' : 'out');
  const sign = isT ? '⇄' : (r.income ? '+' : '−');
  const sub = isT
    ? `${esc(r.account)} → ${esc(r.toAccount)}`
    : `${esc(r.account)}${r.category ? ' · ' + esc(catText(r.category)) : ''}`;
  const feeTxt = r.fee ? ` · 手續費 ${esc(String(r.fee))}` : '';
  const note = r.note ? ' · ' + esc(r.note) : '';
  const dateTxt = withDate ? esc(r.iso) + ' · ' : '';
  const pendTxt = r.pending ? '⏳ 同步中 · ' : '';
  return `<button class="rec" data-sheet="${esc(r.sheet)}" data-row="${r.row}">
    <div class="rec-main">
      <div class="rec-item">${esc(r.item)}</div>
      <div class="rec-sub">${pendTxt}${dateTxt}${sub}${feeTxt}${note}</div>
    </div>
    <div class="rec-amt ${cls}">${sign} ${money(amt)}</div>
  </button>`;
}

function typeLabelOf(r) {
  if (r.type) return r.type;
  return r.transfer ? '轉帳' : (r.income ? '收入' : '支出');
}

// ── 帳戶明細：列出與此帳戶有關的所有紀錄（收支與轉入、轉出）────────
function openAccountDetail(name) {
  const today = todayIso();
  const rel = pool().filter(r => r.account === name || r.toAccount === name)
    .sort((a, b) => (a.iso === b.iso ? b.row - a.row : (a.iso < b.iso ? 1 : -1)));
  const inc = sum(rel.filter(r => r.account === name), 'income');
  const exp = sum(rel.filter(r => r.account === name), 'expense');
  const tout = sum(rel.filter(r => r.account === name), 'transfer');
  const tin = sum(rel.filter(r => r.toAccount === name), 'transfer');
  const balToday = balancesAsOf(today)[name] || 0;
  const balAll = balancesAsOf('9999-12-31')[name] || 0;
  $('accDetailTitle').textContent = name;
  $('accDetailSum').innerHTML = `
    <div class="acc-sum-grid">
      <div><span>目前餘額</span><b class="${balToday < 0 ? 'out' : ''}">${money(balToday)}</b></div>
      <div><span>含未來日期</span><b class="${balAll < 0 ? 'out' : ''}">${money(balAll)}</b></div>
      <div><span>收入</span><b class="in">${money(inc)}</b></div>
      <div><span>支出</span><b class="out">${money(exp)}</b></div>
      <div><span>轉入</span><b>${money(tin)}</b></div>
      <div><span>轉出</span><b>${money(tout)}</b></div>
    </div>
    <p class="hint">共 ${rel.length} 筆有關的紀錄${rel.length > 500 ? '（顯示前 500 筆）' : ''}</p>`;
  const shown = mergeDividendFees(rel).slice(0, 500);
  // 依月份分組，每月標題顯示該帳戶當月的淨變動（與餘額計算規則相同）
  const deltaOf = r => {
    if (r.type === '轉帳' || (r.transfer && !r.income && !r.expense)) {
      return (r.account === name ? -(Number(r.transfer) || 0) : 0) + (r.toAccount === name ? (Number(r.transfer) || 0) : 0);
    }
    return r.account === name ? (Number(r.income) || 0) - (Number(r.expense) || 0) : 0;
  };
  const byMonth = new Map();
  shown.forEach(r => {
    const k = r.iso.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(r);
  });
  $('accDetailList').innerHTML = shown.length
    ? [...byMonth.keys()].sort().reverse().map(k => {
        const rs = byMonth.get(k);
        const net = rs.reduce((x, r) => x + deltaOf(r), 0);
        return `<div class="date-head acc-month-head">${k.replace('-', '年')}月 ｜ 淨變動 <b class="${net < 0 ? 'out' : 'in'}">${net < 0 ? '−' : '+'}${money(Math.abs(net))}</b> ｜ ${rs.length} 筆</div>`
          + rs.map(r => rowHtml(r, true)).join('');
      }).join('')
    : '<div class="empty">這個帳戶還沒有紀錄</div>';
  openModal('accDetailModal');
}

// ── 分析：本月支出分類 ───────────────────────────────────────
function renderAnalysis() {
  $('anaTitle').textContent = `${current} 支出分類`;
  const exps = monthRecords().filter(r => r.expense > 0);
  const total = sum(exps, 'expense');
  $('anaTotal').textContent = money(total);
  const cats = groupSum(exps, r => r.category || '未分類', 'expense');
  const max = cats.length ? cats[0][1] : 0;
  $('anaCats').innerHTML = cats.length ? cats.map(([name, v]) => {
    const open = anaCategory === name;
    return `
    <div class="bar-row toggle${open ? ' active' : ''}" data-cat="${esc(name)}">
      <span class="bar-name">${open ? '▾' : '▸'} ${esc(catText(name))}</span>
      <span class="bar"><i style="width:${max ? (v / max * 100).toFixed(1) : 0}%"></i></span>
      <b>${money(v)}</b>
      <small>${total ? Math.round(v / total * 100) : 0}%</small>
    </div>${open ? catDetailHtml(exps, name) : ''}`;
  }).join('') : '<div class="empty">這個月還沒有支出</div>';
  renderMonthCompare(exps, total);
}

// 本月 vs 上個月的支出分類比較（增加為紅、減少為綠）
function renderMonthCompare(curExps, curTotal) {
  const el = $('anaCompare');
  if (!el) return;
  const m = current.match(/^(\d{4})\/(\d{1,2})/);
  if (!m) { el.innerHTML = ''; return; }
  let y = Number(m[1]), mo = Number(m[2]) - 1;
  if (mo === 0) { y -= 1; mo = 12; }
  const prevYM = `${y}-${pad(mo)}`;
  const prevExps = pool().filter(r => r.expense > 0 && r.iso.startsWith(prevYM + '-'));
  const prevTotal = sum(prevExps, 'expense');
  const curMap = new Map(groupSum(curExps, r => r.category || '未分類', 'expense'));
  const prevMap = new Map(groupSum(prevExps, r => r.category || '未分類', 'expense'));
  const names = [...new Set([...curMap.keys(), ...prevMap.keys()])]
    .sort((a, b) => Math.max(curMap.get(b) || 0, prevMap.get(b) || 0) - Math.max(curMap.get(a) || 0, prevMap.get(a) || 0));
  const diffHtml = (cur, prev) => {
    const d = cur - prev;
    if (d === 0) return '<b>持平</b>';
    const pct = prev ? ` (${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) / prev * 100)}%)` : '（新增）';
    return `<b class="${d > 0 ? 'out' : 'in'}">${d > 0 ? '+' : '−'}${money(Math.abs(d))}${pct}</b>`;
  };
  const note = (!allLoaded && !prevExps.length) ? '<div class="hint">上個月資料還在載入中…</div>' : '';
  el.innerHTML = `
    <div class="cmp-row cmp-total">
      <span class="bar-name">總支出</span>
      <span>本月 ${money(curTotal)}</span>
      <span>上月 ${money(prevTotal)}</span>
      ${diffHtml(curTotal, prevTotal)}
    </div>
    ${names.map(n => `
    <div class="cmp-row">
      <span class="bar-name">${esc(catText(n))}</span>
      <span>本月 ${money(curMap.get(n) || 0)}</span>
      <span>上月 ${money(prevMap.get(n) || 0)}</span>
      ${diffHtml(curMap.get(n) || 0, prevMap.get(n) || 0)}
    </div>`).join('') || '<div class="empty">沒有支出可比較</div>'}
    ${note}`;
}

// ── 年度 ────────────────────────────────────────────────────
function yearsAvailable() {
  const ys = new Set(all.map(r => Number(r.iso.slice(0, 4))));
  ys.add(new Date().getFullYear());
  return [...ys].sort((a, b) => b - a);
}

let expandedCat = null; // 年度分類目前展開的分類名稱
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
  $('yCats').innerHTML = cats.length ? cats.map(([name, v]) => {
    const open = expandedCat === name;
    const detail = open ? catDetailHtml(yr, name) : '';
    return `
    <div class="bar-row toggle${open ? ' active' : ''}" data-cat="${esc(name)}">
      <span class="bar-name">${open ? '▾' : '▸'} ${esc(catText(name))}</span>
      <span class="bar"><i style="width:${max ? (v / max * 100).toFixed(1) : 0}%"></i></span>
      <b>${money(v)}</b>
      <small>${exp ? Math.round(v / exp * 100) : 0}%</small>
    </div>${detail}`;
  }).join('') : '<div class="empty">這一年還沒有支出</div>';
  renderDividendStats(yr);
}

// 年度股息統計：股息轉帳（毛額）、對應的手續費、實收，依股票帳戶分列
function renderDividendStats(yr) {
  const divs = mergeDividendFees(yr).filter(r => r.type === '轉帳' && /股息/.test(r.item || ''));
  const gross = sum(divs, 'transfer');
  const fee = divs.reduce((s, r) => s + (Number(r.fee) || 0), 0);
  $('dGross').textContent = money(gross);
  $('dFee').textContent = money(fee);
  $('dNet').textContent = money(gross - fee);
  $('dCount').textContent = `${divs.length} 次`;
  const byAcc = new Map();
  divs.forEach(r => {
    const k = r.account || '未指定';
    const o = byAcc.get(k) || { gross: 0, fee: 0, count: 0 };
    o.gross += Number(r.transfer) || 0;
    o.fee += Number(r.fee) || 0;
    o.count++;
    byAcc.set(k, o);
  });
  const rows = [...byAcc.entries()].sort((a, b) => b[1].gross - a[1].gross);
  const max = rows.length ? rows[0][1].gross : 0;
  $('dStocks').innerHTML = rows.length ? rows.map(([name, o]) => `
    <div class="bar-row static">
      <span class="bar-name">${esc(name)}</span>
      <span class="bar"><i style="width:${max ? (o.gross / max * 100).toFixed(1) : 0}%"></i></span>
      <b>${money(o.gross - o.fee)}</b>
      <small>${o.count} 次・手續費 ${money(o.fee)}</small>
    </div>`).join('') : '<div class="empty">這一年還沒有股息紀錄</div>';
}

// 展開某分類：列出這一年該分類的所有支出（新到舊）
function catDetailHtml(yr, name, key = 'expense') {
  const rs = yr.filter(r => r[key] > 0 && (r.category || '未分類') === name)
    .sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : b.row - a.row));
  const total = rs.reduce((x, r) => x + (Number(r[key]) || 0), 0);
  return `<div class="cat-detail">
    <div class="cat-detail-head">共 ${rs.length} 筆・${money(total)}</div>
    ${rs.map(r => rowHtml(r, true)).join('') || '<div class="empty">沒有紀錄</div>'}
  </div>`;
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

const PIE_COLORS = ['#0a9396', '#94d2bd', '#005f73', '#7fd6d8', '#3bb8b8', '#c4f1ee', '#2a7f86', '#a8e6e2'];
function renderAssets() {
  const today = todayIso();
  const thisYM = today.slice(0, 7);
  const balToday = balancesAsOf(today);
  const balAll = balancesAsOf('9999-12-31');
  const totals = (bal) => {
    const names = Object.keys(bal);
    return {
      net: names.reduce((s, n) => s + bal[n], 0),
      bank: names.filter(n => ['現金', '銀行'].includes(typeOf(n))).reduce((s, n) => s + bal[n], 0),
      card: names.filter(n => typeOf(n) === '信用卡').reduce((s, n) => s + bal[n], 0)
    };
  };
  const t = totals(balToday), a = totals(balAll);
  $('aNet').textContent = money(t.net);
  $('aNet').className = t.net >= 0 ? 'in' : 'out';
  $('aNetAll').textContent = '含未來日期：' + money(a.net);
  $('aBank').textContent = money(t.bank);
  $('aBankAll').textContent = '含未來：' + money(a.bank);
  $('aCard').textContent = money(t.card);
  $('aCard').className = t.card < 0 ? 'out' : '';
  $('aCardAll').textContent = '含未來：' + money(a.card);

  const names = Object.keys(balAll).concat(Object.keys(balToday)).filter((n, i, arr) => arr.indexOf(n) === i);
  // 現金與銀行各帳戶占「現金與銀行」合計的比例（截至今天）
  const bankNames = names.filter(n => ['現金', '銀行'].includes(typeOf(n)));
  const bankTotal = bankNames.reduce((s, n) => s + (balToday[n] || 0), 0);
  const shareOf = n => bankTotal ? ((balToday[n] || 0) / bankTotal * 100).toFixed(1) + '%' : '-';
  $('aAccounts').innerHTML = TYPE_ORDER.map(tp => {
    const items = names.filter(n => typeOf(n) === tp).sort((x, y) => (balToday[y] || 0) - (balToday[x] || 0));
    if (!items.length) return '';
    const subT = items.reduce((s, n) => s + (balToday[n] || 0), 0);
    const subA = items.reduce((s, n) => s + (balAll[n] || 0), 0);
    return `<div class="acc-group">
      <div class="acc-group-head"><span>${tp}</span><span><b>${money(subT)}</b><small> ｜ 含未來 ${money(subA)}</small></span></div>
      ${items.map(n => `<div class="acc-line" data-acc="${esc(n)}"><span>${esc(n)}</span><span><b class="${(balToday[n] || 0) < 0 ? 'out' : ''}">${money(balToday[n] || 0)}</b><small>含未來 ${money(balAll[n] || 0)}${['現金', '銀行'].includes(tp) ? ` ｜ 占現金與銀行 ${shareOf(n)}` : ''}</small></span></div>`).join('')}
    </div>`;
  }).join('') || '<div class="empty">還沒有帳戶</div>';

  // 現金與銀行占比圓餅圖（截至今天，只計正餘額）
  const pieNames = bankNames.filter(n => (balToday[n] || 0) > 0).sort((x, y) => balToday[y] - balToday[x]);
  const pieTotal = pieNames.reduce((s, n) => s + balToday[n], 0);
  $('assetPieEmpty').classList.toggle('hidden', pieNames.length > 0);
  drawChart('assetPie', {
    type: 'doughnut',
    data: {
      labels: pieNames,
      datasets: [{ data: pieNames.map(n => balToday[n]), backgroundColor: PIE_COLORS.slice(0, pieNames.length), borderWidth: 2, borderColor: '#ffffff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 13 } } },
        tooltip: { callbacks: { label: c => `${c.label}：${money(c.raw)}（${pieTotal ? (c.raw / pieTotal * 100).toFixed(1) : 0}%）` } }
      }
    }
  });

  // 淨值走勢：實線＝截至今天，虛線＝含未來日期
  const ascMonths = months.filter(m => m).slice().sort((x, y) => sheetOrder(x) - sheetOrder(y));
  const sumOf = bal => Object.values(bal).reduce((x, v) => x + v, 0);
  const seriesToday = ascMonths.map(m => isoYM(m) <= thisYM
    ? sumOf(balancesAsOf(isoYM(m) === thisYM ? today : lastDayIso(m))) : null);
  const seriesAll = ascMonths.map(m => sumOf(balancesAsOf(lastDayIso(m))));
  // 本月底數字（截至今天）與可左右滑動的圖表寬度
  const curIdx = ascMonths.findIndex(m => isoYM(m) === thisYM);
  const curVal = curIdx >= 0 ? seriesToday[curIdx] : null;
  $('netCur').textContent = curVal == null ? '-' : money(curVal);
  $('netCur').className = curVal != null && curVal < 0 ? 'out' : 'in';
  if ($('netInner')) $('netInner').style.width = Math.max(ascMonths.length * 68, 320) + 'px';
  // 依月增減上色（台灣習慣）：增加＝紅、減少＝綠、第一個月或無資料＝原本的青色
  const UP = '#dc2626', DOWN = '#16a34a', BASE = '#0a9396';
  const trendColor = (series, i) => {
    if (i <= 0 || series[i] == null || series[i - 1] == null) return BASE;
    return series[i] >= series[i - 1] ? UP : DOWN;
  };
  const segColor = series => ({ segment: { borderColor: ctx => trendColor(series, ctx.p1DataIndex) } });
  const compact = v => Math.abs(v) >= 10000 ? (v / 10000).toFixed(1).replace(/\.0$/, '') + '萬' : Math.round(v).toLocaleString('zh-TW');
  const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const ds = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      const c = chart.ctx;
      c.save();
      c.font = '600 11px "Noto Sans TC", sans-serif';
      c.textAlign = 'center';
      c.fillStyle = getComputedStyle(document.body).color;
      meta.data.forEach((pt, i) => {
        const v = ds.data[i];
        if (v == null) return;
        c.fillStyle = trendColor(ds.data, i);
        c.fillText(compact(v), pt.x, pt.y - 10);
      });
      c.restore();
    }
  };
  drawChart('netChart', {
    type: 'line',
    plugins: [valueLabels],
    data: {
      labels: ascMonths.map(m => m.replace('/', '.').replace('月', '')),
      datasets: [
        { label: '截至今天', data: seriesToday, borderColor: BASE, backgroundColor: 'rgba(10,147,150,.14)', fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: seriesToday.map((_, i) => trendColor(seriesToday, i)), pointBorderColor: seriesToday.map((_, i) => trendColor(seriesToday, i)), spanGaps: false, ...segColor(seriesToday) },
        { label: '含未來日期', data: seriesAll, borderColor: BASE, borderDash: [6, 4], fill: false, tension: .3, pointRadius: 3, pointBackgroundColor: seriesAll.map((_, i) => trendColor(seriesAll, i)), pointBorderColor: seriesAll.map((_, i) => trendColor(seriesAll, i)), ...segColor(seriesAll) }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 18, right: 14, left: 6 } },
      plugins: { legend: { display: true, labels: { font: { size: 12 } } } },
      scales: { y: { ticks: { callback: v => Number(v).toLocaleString('zh-TW') } }, x: { ticks: { font: { size: 12 } } } }
    }
  });
  // 預設捲到最右邊（最新月份）
  const sc = $('netScroll');
  if (sc) sc.scrollLeft = sc.scrollWidth;
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

// asCopy：以這筆紀錄為範本建立新紀錄（日期改為今天，金額保留可再修改）
function openRecordModal(rec = null, asCopy = false) {
  if (rec && rec.pending) { toast('這筆還在同步，請稍等幾秒'); return; }
  lastOpened = rec;
  editing = asCopy ? null : rec;
  $('recTitle').textContent = asCopy ? '複製紀錄' : (rec ? '編輯紀錄' : '新增紀錄');
  $('recDelete').classList.toggle('hidden', !rec || asCopy);
  $('recCopy').classList.toggle('hidden', !rec || asCopy);
  setType(rec ? typeLabelOf(rec) : '支出');
  $('recDate').value = rec && !asCopy ? rec.iso : todayIso();
  $('recAmount').value = rec ? (rec.type === '轉帳' ? rec.transfer : (rec.income || rec.expense)) : '';
  $('recItem').value = rec ? rec.item : '';
  $('recCategory').value = rec ? rec.category : '';
  autoCategory = '';
  $('recNote').value = rec ? rec.note : '';
  fillAccountSelects(rec ? { account: rec.account, toAccount: rec.toAccount } : {});
  $('catList').innerHTML = [...new Set(pool().map(r => r.category).filter(Boolean))]
    .map(c => `<option value="${esc(c)}"></option>`).join('');
  openModal('recModal');
}

// 依項目名稱，從過去紀錄找出最常用的分類，自動帶入（分類欄位是空的或是自動帶入的才會換）
let autoCategory = '';
function suggestCategoryFor(item) {
  const key = String(item || '').trim();
  if (!key) return '';
  const counts = {};
  pool().forEach(r => {
    if (r.item === key && r.category) counts[r.category] = (counts[r.category] || 0) + 1;
  });
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : '';
}
function onItemInput() {
  if (txType === '轉帳') return;
  const cat = $('recCategory');
  const current = cat.value.trim();
  if (current && current !== autoCategory) return;   // 使用者自己填過，不覆蓋
  const suggestion = suggestCategoryFor($('recItem').value);
  if (suggestion) {
    cat.value = suggestion;
    autoCategory = suggestion;
  } else if (current === autoCategory) {
    cat.value = '';
    autoCategory = '';
  }
}

// 儲存成功後，先把紀錄放進畫面（不等整份資料重新載入）；背景再同步校正列號
function makeLocalRecord(sheet, data, row) {
  return {
    sheet, row: row ?? null, pending: row == null,
    iso: data.date, date: String(data.date).slice(5).replace('-', '/'),
    item: data.item, income: Number(data.income) || 0, expense: Number(data.expense) || 0,
    transfer: Number(data.transfer) || 0, account: data.account, toAccount: data.toAccount || '',
    category: data.category || '', note: data.note || '', type: data.type
  };
}
function applyLocalChange(sheet, data, editingRec) {
  if (editingRec) {
    const rec = makeLocalRecord(sheet, data, editingRec.row);
    const same = r => r.sheet === editingRec.sheet && r.row === editingRec.row;
    monthCache = monthCache.map(r => same(r) ? rec : r);
    if (allLoaded) all = all.map(r => same(r) ? rec : r);
  }
  let rec = null;
  if (!editingRec && sheet === current) {
    rec = makeLocalRecord(sheet, data, null);
    monthCache = [...monthCache, rec];
    if (allLoaded) all = [...all, rec];
  }
  renderCurrentTab();
  return rec;
}
function removeLocalRecord(rec) {
  monthCache = monthCache.filter(r => r !== rec);
  all = all.filter(r => r !== rec);
  renderCurrentTab();
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
    let needReloadNow = false;
    if (editing && editing.sheet === targetSheet) {
      await apiPost({ action: 'updateRecord', sheet: editing.sheet, row: editing.row, data: { ...data, expectedItem: editing.item } });
      applyLocalChange(targetSheet, data, editing);
    } else {
      // 換了月份：先刪舊列（列號會變，必須等重新載入），再寫進新月份
      if (editing) { await apiPost({ action: 'delete', sheet: editing.sheet, row: editing.row }); needReloadNow = true; }
      // 先顯示在畫面上（標示同步中），寫入失敗時再移除
      const localRec = applyLocalChange(targetSheet, data, null);
      try {
        await apiPost({ action: 'add', sheet: targetSheet, data });
      } catch (err) {
        if (localRec) removeLocalRecord(localRec);
        throw err;
      }
    }
    closeModal('recModal');
    toast('已儲存 ✓');
    if (targetSheet !== current) await switchMonth(targetSheet);
    if (needReloadNow) await loadAll();
    else loadAll().catch(handleError);   // 背景同步，不擋畫面
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
  $('recItem').addEventListener('input', onItemInput);
  $('recCategory').addEventListener('input', () => { if ($('recCategory').value.trim() !== autoCategory) autoCategory = ''; });
  $('monthSel').addEventListener('change', e => switchMonth(e.target.value));
  $('yearSel').addEventListener('change', renderAnnual);
  $('yCats').addEventListener('click', e => {
    const rec = e.target.closest('.rec');
    if (rec) {
      const r = pool().find(x => x.sheet === rec.dataset.sheet && String(x.row) === rec.dataset.row);
      if (r) openRecordModal(r);
      return;
    }
    const head = e.target.closest('.bar-row[data-cat]');
    if (!head) return;
    const name = head.dataset.cat;
    expandedCat = expandedCat === name ? null : name;
    renderAnnual();
  });
  $('searchInput').addEventListener('input', renderRecords);
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  $('list').addEventListener('click', e => {
    const btn = e.target.closest('.rec');
    if (!btn) return;
    const rec = pool().find(r => r.sheet === btn.dataset.sheet && String(r.row) === btn.dataset.row);
    if (rec) openRecordModal(rec);
  });
  $('anaCats').addEventListener('click', e => {
    const rec = e.target.closest('.rec');
    if (rec) {
      const r = pool().find(x => x.sheet === rec.dataset.sheet && String(x.row) === rec.dataset.row);
      if (r) openRecordModal(r);
      return;
    }
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    anaCategory = anaCategory === btn.dataset.cat ? null : btn.dataset.cat;
    renderAnalysis();
  });
  $('statList').addEventListener('click', e => {
    const rec = e.target.closest('.rec');
    if (rec) {
      const r = pool().find(x => x.sheet === rec.dataset.sheet && String(x.row) === rec.dataset.row);
      if (r) { closeModal('statModal'); openRecordModal(r); }
      return;
    }
    const head = e.target.closest('.bar-row[data-cat]');
    if (!head) return;
    const name = head.dataset.cat;
    statCat = statCat === name ? null : name;
    openStatModal(statKind === 'income' ? 'income' : 'expense');
  });
  document.querySelectorAll('.stat-card').forEach(card =>
    card.addEventListener('click', () => openStatModal(card.dataset.stat)));
  $('aAccounts').addEventListener('click', e => {
    const line = e.target.closest('[data-acc]');
    if (line) openAccountDetail(line.dataset.acc);
  });
  $('accDetailList').addEventListener('click', e => {
    const btn = e.target.closest('.rec');
    if (!btn) return;
    const rec = pool().find(r => r.sheet === btn.dataset.sheet && String(r.row) === btn.dataset.row);
    if (rec) { closeModal('accDetailModal'); openRecordModal(rec); }
  });

  $('recType').addEventListener('click', e => {
    const b = e.target.closest('button[data-type]');
    if (b) setType(b.dataset.type);
  });
  $('recForm').addEventListener('submit', saveRecord);
  $('recDelete').addEventListener('click', deleteRecord);
  $('recCopy').addEventListener('click', () => { if (lastOpened) openRecordModal(lastOpened, true); });
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
