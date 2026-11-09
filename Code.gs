// 個人帳本 — Apps Script 後端（綁定在新的 Google 試算表）
// 每月一個分頁（例如 2026/11月），一列一筆。
// 收入／支出：帳戶 = 這筆錢進出的帳戶。
// 轉帳：帳戶 = 轉出帳戶，轉入帳戶 = 轉入帳戶，金額放「轉帳金額」，不計入收入或支出。
// 設定：專案設定 → 指令碼屬性 → 新增 TOKEN（自己取一組長一點的亂數字串）

const HEADERS = ['日期', '項目', '收入', '支出', '轉帳金額', '帳戶', '轉入帳戶', '分類', '備註', '類型'];
const IMPORT_SHEET = '匯入';   // 把 CSV 匯入到這個分頁後，執行 importFromSheet()
const COL = { date: 0, item: 1, income: 2, expense: 3, transfer: 4, account: 5, toAccount: 6, category: 7, note: 8, type: 9 };

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return !!expected && token === expected;
}

// 2026-11-08 → 2026/11月
function monthSheetName_(dateStr) {
  const m = String(dateStr).match(/^(\d{4})-(\d{1,2})/);
  return m ? m[1] + '/' + parseInt(m[2], 10) + '月' : dateStr;
}

// 日期統一成分頁內的 MM/DD
function shortDate_(v) {
  if (v instanceof Date) {
    return ('0' + (v.getMonth() + 1)).slice(-2) + '/' + ('0' + v.getDate()).slice(-2);
  }
  const s = String(v).trim();
  const iso = s.match(/^\d{4}-(\d{1,2})-(\d{1,2})/);
  if (iso) return ('0' + iso[1]).slice(-2) + '/' + ('0' + iso[2]).slice(-2);
  return s; // 已是 MM/DD
}

function getMonthSheet_(name, create) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh && create) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rowToRecord_(v, rowIndex) {
  return {
    row: rowIndex,
    date: shortDate_(v[COL.date]),
    item: String(v[COL.item] || ''),
    income: Number(v[COL.income]) || 0,
    expense: Number(v[COL.expense]) || 0,
    transfer: Number(v[COL.transfer]) || 0,
    account: String(v[COL.account] || ''),
    toAccount: String(v[COL.toAccount] || ''),
    category: String(v[COL.category] || ''),
    note: String(v[COL.note] || ''),
    type: String(v[COL.type] || '')
  };
}

function recordToRow_(d) {
  const type = d.type || (Number(d.transfer) > 0 ? '轉帳' : (Number(d.income) > 0 ? '收入' : (Number(d.expense) > 0 ? '支出' : '')));
  const row = new Array(HEADERS.length).fill('');
  row[COL.date] = shortDate_(d.date);
  row[COL.item] = d.item || (type === '轉帳' ? '轉帳' : '');
  row[COL.income] = Number(d.income) || '';
  row[COL.expense] = Number(d.expense) || '';
  row[COL.transfer] = Number(d.transfer) || '';
  row[COL.account] = d.account || '';
  row[COL.toAccount] = type === '轉帳' ? (d.toAccount || '') : '';
  row[COL.category] = type === '轉帳' ? '' : (d.category || '');
  row[COL.note] = d.note || '';
  row[COL.type] = type;
  return row;
}

// ── 讀取：GET ?token=...&action=getSheets | getAccounts | getAll&sheet=... ──────────
function doGet(e) {
  const p = e.parameter;
  if (!checkToken_(p.token)) return json_({ error: 'unauthorized' });

  if (p.action === 'getSheets') {
    const names = SpreadsheetApp.getActiveSpreadsheet().getSheets()
      .map(s => s.getName()).filter(n => /^\d{4}\/\d{1,2}月$/.test(n));
    return json_({ sheets: names });
  }

  if (p.action === 'getAccounts') {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('帳戶');
    if (!sh) return json_({ accounts: [] });
    const values = sh.getDataRange().getValues();
    const accounts = [];
    for (let i = 1; i < values.length; i++) {
      if (!values[i][0]) continue;
      accounts.push({ name: String(values[i][0]), type: String(values[i][1] || '') });
    }
    return json_({ accounts });
  }

  if (p.action === 'getAll') {
    const sh = getMonthSheet_(p.sheet, false);
    if (!sh) return json_({ records: [] });
    const values = sh.getDataRange().getValues();
    const records = [];
    for (let i = 1; i < values.length; i++) {
      if (!values[i][COL.item]) continue;     // 沒有項目的列略過
      records.push(rowToRecord_(values[i], i + 1));
    }
    return json_({ records });
  }

  return json_({ error: 'bad action' });
}

// ── 寫入：POST，body 為 JSON（含 token）─────────────────────────────
// add:          { action, token, sheet, data: {date,item,income,expense,transfer,account,toAccount,category,note,type} }
// updateRecord: { action, token, sheet, row, data: {..., expectedItem} }
// delete:       { action, token, sheet, row }
// addAccount:    { action, token, data: {name, type} }
// updateAccount: { action, token, name (原名稱), data: {name (新名稱), type} }   改名會同步更新所有交易
// deleteAccount: { action, token, name }   若仍有交易使用，會拒絕刪除
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (!checkToken_(body.token)) return json_({ error: 'unauthorized' });
  const data = typeof body.data === 'string' ? JSON.parse(body.data) : (body.data || {});

  if (body.action === 'addAccount' || body.action === 'updateAccount' || body.action === 'deleteAccount') {
    return json_(handleAccount_(body.action, body, data));
  }

  if (body.action === 'add') {
    const sh = getMonthSheet_(body.sheet || monthSheetName_(data.date), true);
    sh.appendRow(recordToRow_(data));
    return json_({ ok: true });
  }

  const sh = getMonthSheet_(body.sheet, false);
  if (!sh) return json_({ error: 'sheet not found' });
  const row = Number(body.row);
  if (!row || row < 2) return json_({ error: 'bad row' });

  if (body.action === 'updateRecord') {
    const current = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    if (data.expectedItem !== undefined && String(current[COL.item]) !== String(data.expectedItem)) {
      return json_({ error: 'conflict', message: '這一列已被改動，請重新整理' });
    }
    sh.getRange(row, 1, 1, HEADERS.length).setValues([recordToRow_(data)]);
    return json_({ ok: true });
  }

  if (body.action === 'delete') {
    sh.deleteRow(row);
    return json_({ ok: true });
  }

  return json_({ error: 'bad action' });
}

// ── 一次性匯入：把 CSV 貼到「匯入」分頁（表頭需含：日期,項目,收入,支出,轉帳金額,帳戶,轉入帳戶,分類,備註,類型）
//    執行 importFromSheet()，會依月份附加到各個月分頁。注意：重跑會重複寫入，請先清空已匯入的月份分頁
function importFromSheet() {
  const src = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IMPORT_SHEET);
  if (!src) throw new Error('找不到「' + IMPORT_SHEET + '」分頁');
  const values = src.getDataRange().getValues();
  const groups = {};
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0] || !r[1]) continue;
    const dateKey = r[0] instanceof Date
      ? r[0].getFullYear() + '-' + (r[0].getMonth() + 1) + '-' + r[0].getDate()
      : r[0];
    const name = monthSheetName_(dateKey);
    (groups[name] = groups[name] || []).push(recordToRow_({
      date: r[0], item: r[1], income: r[2], expense: r[3], transfer: r[4],
      account: r[5], toAccount: r[6], category: r[7], note: r[8], type: r[9]
    }));
    count++;
  }
  Object.keys(groups).forEach(name => {
    const sh = getMonthSheet_(name, true);
    const rows = groups[name];
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
  });
  Logger.log('匯入完成：' + Object.keys(groups).length + ' 個月份，共 ' + count + ' 筆');
}

// ── 帳戶清單（分頁「帳戶」：名稱、類型）────────────────────────────
function accountSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('帳戶');
  if (!sh) {
    sh = ss.insertSheet('帳戶');
    sh.appendRow(['名稱', '類型']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function findAccountRow_(sh, name) {
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(name)) return i + 1;
  }
  return -1;
}

// 所有月份分頁中，帳戶欄位（F 轉出／帳戶、G 轉入帳戶）的 range 與值
function monthTransactionRanges_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .filter(s => /^\d{4}\/\d{1,2}月$/.test(s.getName()) && s.getLastRow() > 1)
    .map(s => ({ sh: s, range: s.getRange(2, COL.account + 1, s.getLastRow() - 1, 2) }));
}

function handleAccount_(action, body, data) {
  const sh = accountSheet_();

  if (action === 'addAccount') {
    const name = String(data.name || '').trim();
    if (!name) return { error: 'name required', message: '請輸入帳戶名稱' };
    if (findAccountRow_(sh, name) > 0) return { error: 'duplicate', message: '已有同名帳戶' };
    sh.appendRow([name, String(data.type || '其他')]);
    return { ok: true };
  }

  const oldName = String(body.name || '');
  const row = findAccountRow_(sh, oldName);
  if (row < 0) return { error: 'not found', message: '找不到這個帳戶' };

  if (action === 'updateAccount') {
    const newName = String(data.name || '').trim();
    if (!newName) return { error: 'name required', message: '請輸入帳戶名稱' };
    if (newName !== oldName && findAccountRow_(sh, newName) > 0) return { error: 'duplicate', message: '已有同名帳戶' };
    sh.getRange(row, 1, 1, 2).setValues([[newName, String(data.type || '其他')]]);
    if (newName !== oldName) {
      monthTransactionRanges_().forEach(({ range }) => {
        const vals = range.getValues();
        let changed = false;
        vals.forEach(r => r.forEach((v, j) => { if (String(v) === oldName) { r[j] = newName; changed = true; } }));
        if (changed) range.setValues(vals);
      });
    }
    return { ok: true };
  }

  if (action === 'deleteAccount') {
    let used = 0;
    monthTransactionRanges_().forEach(({ range }) => {
      range.getValues().forEach(r => r.forEach(v => { if (String(v) === oldName) used++; }));
    });
    if (used > 0) return { error: 'in use', message: '還有 ' + used + ' 筆交易使用此帳戶，無法刪除' };
    sh.deleteRow(row);
    return { ok: true };
  }

  return { error: 'bad action' };
}
