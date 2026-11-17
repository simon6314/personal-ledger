// 我的帳本 — 首頁「我的帳本大樓」：上面是四層樓的動畫大樓（你＋三位小幫手，搭電梯跑來跑去），下面是本月收支與占比
// 依賴 app.js 的全域：monthRecords、current、months、monthData、allLoaded、accounts、balancesAsOf、
// isStockAcc、groupSum、sum、money、esc、catText、drawChart、todayIso、sheetOrder、mergeDividendFees

// ── 大樓設定（座標以 1000 × 2100 的大樓剖面為準）────────────────────
// 由上到下：屋頂、6F 老闆辦公室、5F 轉帳中心、4F 股票交易室、3F 分析室、2F 記帳室、1F 大廳／休息區、街道（樓層對應見 HM_ROOM）
const HM_W = 1000, HM_H = 2100;
const HM_FT = { 6: 140, 5: 440, 4: 740, 3: 1040, 2: 1340, 1: 1640 };          // 各樓層天花板 y
const HM_FH = 300;
const hmFL = f => HM_FT[f] + 280;                            // 該樓層地板線（站立的 y）
const hmFeet = hmFL;
const HM_LIFT_X = 906, HM_LIFT_DOOR = 806;                    // 電梯車廂中心、電梯門口
// 每個房間在幾樓（老闆辦公室在頂樓）
const HM_ROOM = { boss: 6, xfer: 5, stock: 4, chart: 3, book: 2, lobby: 1 };
const HM_SPOTS = {
  stock: [380, HM_ROOM.stock], monitor: [520, HM_ROOM.stock], vault: [690, HM_ROOM.stock],
  chart: [560, HM_ROOM.chart], board: [300, HM_ROOM.chart], shelf: [740, HM_ROOM.chart],
  me: [480, HM_ROOM.boss], sofa: [730, HM_ROOM.boss], window: [210, HM_ROOM.boss],
  book: [320, HM_ROOM.book], cabinet: [560, HM_ROOM.book], notice: [720, HM_ROOM.book],
  door: [110, HM_ROOM.lobby], guide: [270, HM_ROOM.lobby], lounge: [430, HM_ROOM.lobby], lounge2: [510, HM_ROOM.lobby], coffee: [650, HM_ROOM.lobby], coffee2: [730, HM_ROOM.lobby],
  xfer: [400, HM_ROOM.xfer], tube: [150, HM_ROOM.xfer], atm: [600, HM_ROOM.xfer], lockers: [730, HM_ROOM.xfer],
  meetBook: [385, HM_ROOM.boss], meetChart: [575, HM_ROOM.boss], meetStock: [610, HM_ROOM.boss], meetXfer: [385, HM_ROOM.boss],
};
const HM_ACTORS = [
  { id: 'me', name: '我', role: '老闆', seat: 'me', look: { skin: '#fcdcc4', hair: '#1f1d24', hs: 'side', cloth: '#3b4a6b', tie: '#ef7d9a', g: 'm' } },
  { id: 'book', name: '小記', role: '記帳員', seat: 'book', look: { skin: '#ffe4d0', hair: '#5b3a29', hs: 'bob', cloth: '#f7a8c0', g: 'f', glasses: true } },
  { id: 'chart', name: '小分', role: '分析員', seat: 'chart', look: { skin: '#fcdcc4', hair: '#2e2a30', hs: 'pony', cloth: '#9fd0f0', g: 'f' } },
  { id: 'xfer', name: '小轉', role: '轉帳交易員', seat: 'xfer', look: { skin: '#fbdcc6', hair: '#7a4b2e', hs: 'side', cloth: '#c9a0e6', tie: '#7fd6e6', g: 'm' } },
  { id: 'stock', name: '小股', role: '股票員', seat: 'stock', look: { skin: '#f6d2b8', hair: '#3b2f2f', hs: 'short', cloth: '#4f6f5f', tie: '#ffd66b', g: 'm' } },
];
const HM_FLOOR_NAME = Object.fromEntries(Object.entries({ boss: '老闆辦公室', xfer: '轉帳中心', stock: '股票交易室', chart: '分析室', book: '記帳室', lobby: '大廳・休息區' }).map(([k, n]) => [HM_ROOM[k], `${HM_ROOM[k]}F ${n}`]));
const hmSpot = k => { const s = HM_SPOTS[k]; return { x: s[0], f: s[1] }; };
const hmNight = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

// ── Q 版小人（跟共同帳本辦公室同一套畫法）──────────────────────────
function hmPerson(lk) {
  const h = lk.hair;
  const back = lk.hs === 'bob' ? `<path d="M17 36 Q14 11 40 11 Q66 11 63 36 L63 53 Q53 52 51 45 L29 45 Q27 52 17 53 Z" fill="${h}"/>`
    : lk.hs === 'pony' ? `<path d="M57 20 Q77 24 71 54 Q66 42 57 36 Z" fill="${h}"/><circle cx="59" cy="22" r="3" fill="#ef7d9a"/>` : '';
  const front = lk.hs === 'short' ? `<path d="M18.5 36 Q16 11 40 11 Q64 11 61.5 36 Q57 22 40 22 Q23 22 18.5 36 Z" fill="${h}"/>`
    : lk.hs === 'side' ? `<path d="M18.5 36 Q15 10 42 11 Q65 12 61.5 34 Q55 23 34 21 Q24 25 18.5 36 Z" fill="${h}"/>`
    : `<path d="M19 34 Q17 11 40 11 Q63 11 61 34 Q55 20 45 21 Q42 27 36 21 Q25 21 19 34 Z" fill="${h}"/>`;
  const body = lk.g === 'f'
    ? `<path d="M28 57 Q40 53 52 57 L54 66 L61 87 Q40 92 19 87 L26 66 Z" fill="${lk.cloth}"/><path d="M32 58.6 Q40 63.6 48 58.6" stroke="#fff" stroke-width="1.4" fill="none" opacity=".7"/>`
    : `<ellipse cx="40" cy="73" rx="16.5" ry="14.5" fill="${lk.cloth}"/><path d="M34 59 L40 69 L46 59 Z" fill="#fff"/><path d="M40 62 L38.2 71 L40 74 L41.8 71 Z" fill="${lk.tie}"/>`;
  const arms = `<g class="hm-arm hm-arm-l"><path d="M25.5 61 Q19 68 21.4 77" stroke="${lk.cloth}" stroke-width="6.6" stroke-linecap="round" fill="none"/><circle cx="21.5" cy="78.2" r="3.3" fill="${lk.skin}"/></g>
    <g class="hm-arm hm-arm-r"><path d="M54.5 61 Q61 68 58.6 77" stroke="${lk.cloth}" stroke-width="6.6" stroke-linecap="round" fill="none"/><circle cx="58.5" cy="78.2" r="3.3" fill="${lk.skin}"/></g>`;
  const glasses = lk.glasses ? '<circle cx="31" cy="38" r="5.8" fill="rgba(255,255,255,.28)" stroke="#5a5360" stroke-width="1.4"/><circle cx="49" cy="38" r="5.8" fill="rgba(255,255,255,.28)" stroke="#5a5360" stroke-width="1.4"/><path d="M36.8 38 h6.4" stroke="#5a5360" stroke-width="1.4"/>' : '';
  return `<svg viewBox="0 0 80 92" aria-hidden="true"><ellipse cx="40" cy="89" rx="18" ry="3.6" fill="rgba(70,40,20,.2)"/>${back}
    <ellipse cx="34" cy="88.6" rx="4.6" ry="2.4" fill="#3a2f2b"/><ellipse cx="46" cy="88.6" rx="4.6" ry="2.4" fill="#3a2f2b"/>${body}${arms}
    <g class="hm-head"><ellipse cx="19.6" cy="38.5" rx="3.2" ry="4" fill="${lk.skin}"/><ellipse cx="60.4" cy="38.5" rx="3.2" ry="4" fill="${lk.skin}"/>
    <ellipse cx="40" cy="36" rx="21" ry="20" fill="${lk.skin}"/>
    <g class="hm-eye"><ellipse cx="31" cy="38" rx="3.1" ry="3.7" fill="#2f2622"/><circle cx="32.2" cy="36.5" r="1.3" fill="#fff"/><ellipse cx="49" cy="38" rx="3.1" ry="3.7" fill="#2f2622"/><circle cx="50.2" cy="36.5" r="1.3" fill="#fff"/></g>
    <g class="hm-eye-h"><path d="M27.5 39 Q31 35 34.5 39 M45.5 39 Q49 35 52.5 39" fill="none" stroke="#2f2622" stroke-width="1.8" stroke-linecap="round"/></g>
    <path d="M36.4 46.2 Q40 49.4 43.6 46.2" fill="none" stroke="#b9728a" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="24.5" cy="44" rx="3.8" ry="2.2" fill="#ff8fa6" opacity=".45"/><ellipse cx="55.5" cy="44" rx="3.8" ry="2.2" fill="#ff8fa6" opacity=".45"/>
    ${front}${glasses}</g></svg>`;
}

// ── 資料整理 ────────────────────────────────────────────────
function hmShortMoney(n) {
  n = Math.round(Number(n) || 0);
  return Math.abs(n) >= 10000 ? (n / 10000).toFixed(Math.abs(n) >= 100000 ? 0 : 1).replace(/\.0$/, '') + ' 萬' : n.toLocaleString('zh-TW');
}
function hmData() {
  const recs = monthRecords();
  const real = recs.filter(r => r.type !== '轉帳');
  const inc = sum(real, 'income'), exp = sum(real, 'expense');
  const exps = real.filter(r => Number(r.expense) > 0);
  const incs = real.filter(r => Number(r.income) > 0);
  const cats = groupSum(exps, r => r.category || '未分類', 'expense');
  const incCats = groupSum(incs, r => r.category || '未分類', 'income');
  const today = todayIso();
  const isNow = current === sheetFromIso(today);
  const todayCount = recs.filter(r => r.iso === today).length;
  const latest = recs.filter(r => r.item).slice().sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : (b.row || 0) - (a.row || 0)))[0];
  const biggest = exps.slice().sort((a, b) => b.expense - a.expense)[0];
  // 跟上個月同期比
  const idx = months.slice().sort((a, b) => sheetOrder(a) - sheetOrder(b)).indexOf(current);
  const sorted = months.slice().sort((a, b) => sheetOrder(a) - sheetOrder(b));
  const prevSheet = idx > 0 ? sorted[idx - 1] : null;
  const day = isNow ? Number(today.slice(8)) : 31;
  const prevRecs = prevSheet && Array.isArray(monthData[prevSheet]) ? monthData[prevSheet].filter(r => r.type !== '轉帳') : null;
  const prevSame = prevRecs ? sum(prevRecs.filter(r => Number(String(r.iso || '').slice(8)) <= day), 'expense') : null;
  const prevTotal = prevRecs ? sum(prevRecs, 'expense') : null;
  // 股票
  let stockBal = null, divYear = 0;
  if (allLoaded && accounts.length) {
    const bal = balancesAsOf(today);
    stockBal = Object.entries(bal).filter(([n]) => isStockAcc(n)).reduce((s, [, v]) => s + v, 0);
    const yr = today.slice(0, 4);
    divYear = sum(mergeDividendFees(all.filter(r => String(r.iso || '').startsWith(yr))).filter(r => r.type === '轉帳' && /股息/.test(r.item || '')), 'transfer');
  }
  // 轉帳：本月筆數、總額、最常走的路線、最新一筆；各帳戶餘額
  const xfers = recs.filter(r => r.type === '轉帳');
  const xferTotal = sum(xfers, 'transfer');
  const routes = groupSum(xfers, r => `${r.account || '?'}→${r.toAccount || '?'}`, 'transfer');
  const latestXfer = xfers.slice().sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : (b.row || 0) - (a.row || 0)))[0] || null;
  // 帳戶餘額不含股票帳戶（股票在股票交易室看）
  let accBal = [], cashTotal = null;
  if (allLoaded && accounts.length) {
    const nonStock = Object.entries(balancesAsOf(today)).filter(([n, v]) => !isStockAcc(n) && Math.round(v));
    cashTotal = nonStock.reduce((s, [, v]) => s + v, 0);
    accBal = nonStock.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4);
  }
  return { recs, inc, exp, cats, incCats, todayCount, latest, biggest, isNow, prevSame, prevTotal, prevSheet, stockBal, divYear, count: recs.length, xfers, xferTotal, routes, latestXfer, accBal, cashTotal };
}

// ── 台詞 ────────────────────────────────────────────────────
const pk = a => a[Math.floor(Math.random() * a.length)];
function hmLine(id, d) {
  const pct = (v, t) => (t ? Math.round(v / t * 100) : 0);
  const top = d.cats[0];
  const bal = d.inc - d.exp;
  if (id === 'me') return pk([
    d.exp ? `這個月花了 ${hmShortMoney(d.exp)}…嗯 🤔` : '這個月還沒花錢，太神了 😎',
    bal >= 0 ? `目前結餘 +${hmShortMoney(bal)}，不錯不錯 😊` : `結餘 −${hmShortMoney(-bal)}…要省一點了 😅`,
    '今天也要好好記帳 ✍️', '喝杯咖啡再來看帳 ☕', '錢錢要看清楚 👀',
  ]);
  if (id === 'book') return pk([
    d.count ? `這個月記了 ${d.count} 筆 📒` : '這個月的帳本還是空的 📒',
    d.isNow ? (d.todayCount ? `今天記了 ${d.todayCount} 筆，很棒！✨` : '今天還沒記帳喔～ 📝') : `${current} 的帳都在這 📒`,
    d.latest ? `最新一筆：${d.latest.item} ${d.latest.expense ? '−' + hmShortMoney(d.latest.expense) : d.latest.income ? '+' + hmShortMoney(d.latest.income) : ''}` : '等你來記第一筆 ✍️',
    d.biggest ? `最大一筆是「${d.biggest.item}」${hmShortMoney(d.biggest.expense)} 💸` : '還沒有支出，帳本好乾淨 🫧',
  ]);
  if (id === 'chart') return pk([
    top ? `支出最多：${catText(top[0])} ${pct(top[1], d.exp)}% 📊` : '還沒有支出可以分析 📊',
    d.cats[1] ? `第二名是 ${catText(d.cats[1][0])}，${pct(d.cats[1][1], d.exp)}%` : '分類很單純耶 📊',
    d.inc ? `收入 ${hmShortMoney(d.inc)}，花掉 ${pct(d.exp, d.inc)}% 💡` : '這個月還沒有收入入帳 💡',
    d.prevSame != null && d.isNow ? (d.exp > d.prevSame ? `比上月同期多花 ${hmShortMoney(d.exp - d.prevSame)} ⚠️` : `比上月同期少花 ${hmShortMoney(d.prevSame - d.exp)} 👍`) : '數字整理好了 ✨',
  ]);
  if (id === 'xfer') {
    const lx = d.latestXfer, rt = d.routes[0];
    return pk([
      d.xfers.length ? `這個月轉帳 ${d.xfers.length} 筆，共 ${hmShortMoney(d.xferTotal)} 🔁` : '這個月還沒有轉帳，櫃台好清閒 🔁',
      lx ? `最新一筆：${lx.account} → ${lx.toAccount}，${hmShortMoney(lx.transfer)} 💸` : '轉帳單都蓋好章了 🖋️',
      rt ? `最常走的路線：${rt[0].replace('→', ' → ')} 🚚` : '錢只是換個口袋，不是花掉喔 👛',
      d.accBal[0] ? `目前最多錢的是「${d.accBal[0][0]}」${hmShortMoney(d.accBal[0][1])} 🏦` : '帳戶餘額整理中… 🏦',
      '轉帳不算支出，別搞混囉 😉', '氣送管咻～一聲就送到了 🚀',
    ]);
  }
  return pk([
    d.stockBal != null ? `股票帳戶現在 ${hmShortMoney(d.stockBal)} 📈` : '股票資料還在載入中… 📈',
    d.divYear ? `今年領了股息 ${hmShortMoney(d.divYear)} 💰` : '今年還沒領到股息，再等等 🌱',
    '長期投資，耐心最重要 🐢', '盯盤中…綠油油的別嚇我 😵', '今天的紅綠燈… 🚦',
  ]);
}
// 小幫手去找你報告
function hmReport(id, d) {
  const top = d.cats[0];
  if (id === 'book') return [
    { who: 'book', text: d.latest ? `老闆～最新一筆「${d.latest.item}」記好了 📒` : '老闆～這個月還沒記帳喔 📒' },
    { who: 'me', text: d.latest ? '收到，謝謝小記 👍' : '好啦好啦，等等就記 😅' },
  ];
  if (id === 'chart') return [
    { who: 'chart', text: top ? `報告！這個月 ${catText(top[0])} 花最多，${hmShortMoney(top[1])} 📊` : '報告！這個月還沒有支出 📊' },
    { who: 'me', text: top ? pk(['原來錢都跑去那了 😳', '嗯…下個月注意一下', '還在預期內 😌']) : '太好了 😎' },
  ];
  if (id === 'xfer') return [
    { who: 'xfer', text: d.xfers.length ? `老闆～這個月轉了 ${d.xfers.length} 筆，共 ${hmShortMoney(d.xferTotal)} 🔁` : '老闆～這個月還沒有轉帳喔 🔁' },
    { who: 'me', text: pk(['錢有乖乖到位就好 👌', '辛苦了，記得對一下餘額 🧾', '轉來轉去別轉丟了 😆']) },
  ];
  return [
    { who: 'stock', text: d.divYear ? `今年股息累積 ${hmShortMoney(d.divYear)} 了！💰` : '今天市場還算平靜 📈' },
    { who: 'me', text: pk(['讚，繼續存股 🐢', '穩穩的就好 😌', '不要亂買喔 😆']) },
  ];
}

// ── 動畫 ────────────────────────────────────────────────────
// ── 動畫：走路、電梯 ───────────────────────────────────────────
let hmActors = {}, hmRaf = 0, hmLast = 0, hmData_ = null, hmNext = 0, hmBuilt = false, hmClockT = 0;
const hmLift = { y: HM_FT[1], target: null, done: null, queue: Promise.resolve(), el: null, doorEl: null };
function hmPlace(a) {
  a.el.style.left = (a.pos[0] / HM_W * 100) + '%';
  a.el.style.top = (a.pos[1] / HM_H * 100) + '%';
  a.el.style.zIndex = String(Math.round(a.pos[1]) + (a.inLift ? 3000 : 0) + (a.bub ? 6000 : 0));
}
function hmSay(id, text, ms = 3000, cls = '') {
  const a = hmActors[id];
  if (!a) return;
  clearTimeout(a.bt);
  a.bubEl.textContent = text;
  a.bubEl.className = 'hm-bub show ' + cls + (a.pos[0] > 720 ? ' edge-r' : a.pos[0] < 250 ? ' edge-l' : '');
  a.bub = true; hmPlace(a);
  a.bt = setTimeout(() => { a.bubEl.className = 'hm-bub'; a.bub = false; hmPlace(a); }, ms);
}
const hmWait = ms => new Promise(r => setTimeout(r, ms));
function hmStep(a, x) {
  return new Promise(res => { a.target = [x, hmFeet(a.floor)]; a.done = res; a.el.classList.add('walk'); });
}
function hmLiftTo(f) {
  return new Promise(res => { hmLift.target = HM_FT[f]; hmLift.done = res; });
}
function hmDoors(open) { hmLift.doorEl.classList.toggle('open', open); hmLift.el.classList.toggle('open', open); return hmWait(450); }
// 車廂高度跟每層的電梯門一樣（170），貼齊該層地板
function hmLiftPos() { hmLift.el.style.top = ((hmLift.y + 110) / HM_H * 100) + '%'; }
// 搭電梯：一次載一個人，其他人排隊
function hmRide(a, to) {
  const job = hmLift.queue.then(async () => {
    $('hmLiftInd').textContent = `${a.floor}F`;
    await hmLiftTo(a.floor);
    await hmDoors(true);
    a.inLift = true;
    await hmStep(a, HM_LIFT_X);
    await hmDoors(false);
    a.riding = true;
    await hmLiftTo(to);
    a.riding = false;
    a.floor = to;
    await hmDoors(true);
    await hmStep(a, HM_LIFT_DOOR);
    a.inLift = false;
    await hmDoors(false);
  });
  hmLift.queue = job.catch(() => {});
  return job;
}
function hmGo(id, key) { const s = hmSpot(key); return hmGoTo(id, s.x, s.f); }
async function hmGoTo(id, x, f) {
  const a = hmActors[id], s = { x, f };
  if (a.floor !== s.f) {
    a.el.classList.add('walk');
    await hmStep(a, HM_LIFT_DOOR);
    a.el.classList.remove('walk');
    hmSay(id, '等電梯中… 🛗', 1600);
    await hmRide(a, s.f);
  }
  await hmStep(a, s.x);
}
function hmTick(now) {
  hmRaf = requestAnimationFrame(hmTick);
  const dt = Math.min(0.1, hmLast ? (now - hmLast) / 1000 : 0);
  hmLast = now;
  // 電梯
  if (hmLift.target != null) {
    const dy = hmLift.target - hmLift.y, step = 420 * dt;
    if (Math.abs(dy) <= step) { hmLift.y = hmLift.target; hmLift.target = null; const f = hmLift.done; hmLift.done = null; if (f) f(); }
    else hmLift.y += Math.sign(dy) * step;
    hmLiftPos();
    const fl = [1, 2, 3, 4, 5, 6].reduce((b, f) => (Math.abs(HM_FT[f] - hmLift.y) < Math.abs(HM_FT[b] - hmLift.y) ? f : b), 1);
    $('hmLiftInd').textContent = (hmLift.target == null ? '' : hmLift.target < hmLift.y ? '▲ ' : '▼ ') + `${fl}F`;
  }
  Object.values(hmActors).forEach(a => {
    if (a.riding) { a.pos[1] = hmLift.y + 280; hmPlace(a); return; }
    if (!a.target) return;
    const dx = a.target[0] - a.pos[0], dy = a.target[1] - a.pos[1], dist = Math.hypot(dx, dy), step = 150 * dt;
    if (Math.abs(dx) > 1) a.figEl.classList.toggle('flip', dx < 0);
    if (dist <= step) {
      a.pos = a.target.slice(); a.target = null; a.el.classList.remove('walk');
      const f = a.done; a.done = null; if (f) f();
    } else { a.pos[0] += dx / dist * step; a.pos[1] += dy / dist * step; }
    hmPlace(a);
  });
  if (now > hmNext && hmData_) { hmNext = now + 3500 + Math.random() * 4500; hmIdle(); }
  // 每分鐘更新時鐘和白天／晚上
  if (now - hmClockT > 60000) { hmClockT = now; if (hmData_) hmDrawBuilding(hmData_); }
}
// ── 角色之間的對話 ───────────────────────────────────────────
const HM_NAME = { me: '老闆', book: '小記', chart: '小分', stock: '小股', xfer: '小轉' };
// a 去找 b 聊天時的台詞（依兩人的工作內容）
function hmTalk(a, b, d) {
  const top = d.cats[0], lx = d.latestXfer;
  const T = (x, y) => [{ who: a, text: x }, { who: b, text: y }];
  const pairs = {
    'book>chart': [T(d.count ? `小分～這個月 ${d.count} 筆都記好了，交給你 📒` : '小分，這個月還沒什麼帳耶 📒', top ? `收到！看起來${catText(top[0])}花最多 📊` : '好，我先把白板擦乾淨 ✨')],
    'chart>book': [T(top ? `小記，${catText(top[0])}是不是記太多了？😂` : '小記，最近都沒有新的帳嗎？', '我只是照實記啦～ 📝'), T('分類可以再細一點嗎？', '好，下次幫你分清楚 ✍️')],
    'xfer>stock': [T(lx && isStockAcc(lx.toAccount || '') ? `剛轉了 ${hmShortMoney(lx.transfer)} 進股票帳戶喔 🔁` : '股票帳戶最近要入金嗎？🔁', pk(['收到，資金到位 📈', '先觀望一下 🐢', '等我看完盤再說 👀']))],
    'stock>xfer': [T(d.divYear ? '股息入帳了，幫我轉出來 💰' : '股票帳戶的錢先別動喔 🐢', '沒問題，氣送管伺候 🚀')],
    'xfer>book': [T('剛剛的轉帳也記進帳本了嗎？🔁', '記好了，放心 ✅'), T('轉帳不算支出，別記錯喔 😉', '知道啦～ 📒')],
    'book>xfer': [T('小轉，這筆是轉帳還是支出啊？🤔', '帳戶之間搬錢就是轉帳喔 🔁')],
    'chart>stock': [T('股票的部分我也想放進報表 📊', d.stockBal != null ? `目前帳戶 ${hmShortMoney(d.stockBal)}，拿去用 📈` : '等資料載完給你 📈')],
    'stock>chart': [T('幫我算一下今年股息占收入多少？', d.inc ? `大概是 ${Math.round(d.divYear / Math.max(1, d.inc) * 100)}% 左右 📊` : '收入還沒進來，算不出來 😅')],
    'chart>xfer': [T('這個月錢都轉去哪了？', d.routes[0] ? `最常走 ${d.routes[0][0].replace('→', ' → ')} 🚚` : '這個月都沒轉帳喔 🔁')],
    'xfer>chart': [T('轉帳要不要也做張圖表？📊', '好主意，我研究一下 🤓')],
    'book>stock': [T('股票買賣要怎麼記比較好？', '記成轉帳到股票帳戶就行 📈')],
    'stock>book': [T('股息那筆記了沒？💰', d.divYear ? '記了！今年第一名的好消息 🎉' : '還沒看到股息耶 🤔')],
  };
  const general = [T('午餐吃什麼？🍱', pk(['便當！', '我想吃拉麵 🍜', '隨便都好～'])), T('今天好忙 😵', '加油！💪'), T('下班要不要去走走？', '好啊，記帳記完就走 🚶'), T('你今天記帳了嗎？', '當然 ✍️')];
  if (a === 'me') return [{ who: 'me', text: pk(['辛苦了！最近怎麼樣？', '大家今天都好嗎？😊', '有什麼要報告的嗎？']) }, { who: b, text: hmLine(b, d) }, { who: 'me', text: pk(['很好，繼續加油 👍', '辛苦了 ☕', '讚 😎']) }];
  if (b === 'me') return hmReport(a, d);
  return pk([...(pairs[`${a}>${b}`] || []), ...(pairs[`${a}>${b}`] ? [] : general), ...(Math.random() < 0.25 ? general : [])]);
}
// 在休息區喝咖啡時遇到人
function hmCoffeeTalk(a, b, d) {
  const T = (x, y) => [{ who: a, text: x }, { who: b, text: y }];
  if (b === 'me') return pk([T('老闆也來喝咖啡！😳', '大家辛苦了，今天咖啡我請 ☕'), T('老闆早～', '早！記得多喝水 💧')]);
  if (a === 'me') return pk([T('咖啡好喝嗎？', '超好喝，續命成功 😆'), T(`${HM_NAME[b]}也在休息啊`, '老闆好！喘口氣而已 😅')]);
  return pk([T('你也來裝咖啡啊 ☕', '對啊，續命一下 😆'), T('要不要加奶？🥛', '黑咖啡就好 ☕'), T('今天的咖啡豆好香 🌰', '新換的喔～'), T('飲水機的水好冰 🧊', '夏天剛好 😌'), T(`${HM_NAME[b]}，等等一起回去？`, '好，等我喝完 ☕')]);
}
async function hmChat(lines) {
  for (const ln of lines) { hmSay(ln.who, ln.text, 2800); hmJoy(ln.who, 700); await hmWait(2400); }
}
const hmFace = (a, b) => { a.figEl.classList.toggle('flip', a.pos[0] > b.pos[0]); b.figEl.classList.toggle('flip', b.pos[0] > a.pos[0]); };

// 去休息區裝咖啡；遇到人就聊兩句，偶爾坐一下沙發
async function hmCoffee(a) {
  const d = hmData_;
  const other = Object.values(hmActors).find(x => x !== a && x.atCoffee);
  await hmGo(a.id, other && Math.abs(other.pos[0] - hmSpots('coffee')) < 40 ? 'coffee2' : 'coffee');
  a.atCoffee = true;
  try {
    a.el.classList.add('cup');
    hmSay(a.id, pk(['裝杯咖啡 ☕', '續命時間到 ☕', '來杯拿鐵 🥛', '先喝口水 💧', '咖啡機你好 ☕']), 2400);
    await hmWait(2400);
    const mate = Object.values(hmActors).find(x => x !== a && x.floor === a.floor && (x.atCoffee || !x.busy));
    if (mate) {
      hmFace(a, mate);
      await hmChat(hmCoffeeTalk(a.id, mate.id, d));
    } else if (Math.random() < 0.6) {
      await hmGo(a.id, Object.values(hmActors).some(x => x !== a && x.lounging) ? 'lounge2' : 'lounge');
      a.lounging = true;
      a.el.classList.add('rest');
      hmSay(a.id, pk(['坐一下下就好 🛋️', '大廳的沙發好軟 😌', '看一下電視 📺']), 2600);
      await hmWait(3200);
      a.el.classList.remove('rest');
      a.lounging = false;
    }
  } finally { a.atCoffee = false; }
  await hmGo(a.id, a.seat);
  hmSay(a.id, pk(['回來工作了 💪', '咖啡喝完，繼續 ✍️', '充電完畢 🔋']), 1800);
  await hmWait(1600);
  a.el.classList.remove('cup');
}
const hmSpots = k => HM_SPOTS[k][0];
// 去找另一個人聊天
async function hmVisit(a) {
  const d = hmData_;
  const cand = Object.values(hmActors).filter(x => x !== a && !x.busy && x.id !== 'me');
  if (!cand.length) return false;
  const b = pk(cand);
  b.busy = true;
  try {
    const x = b.pos[0] + (b.pos[0] > 560 ? -95 : 95);
    await hmGoTo(a.id, x, b.floor);
    hmFace(a, b);
    await hmChat(hmTalk(a.id, b.id, d));
  } finally { b.busy = false; b.figEl.classList.remove('flip'); }
  await hmGo(a.id, a.seat);
  return true;
}
async function hmIdle() {
  const free = Object.values(hmActors).filter(a => !a.busy);
  if (!free.length) return;
  const a = pk(free);
  const d = hmData_;
  const r = Math.random();
  a.busy = true;
  try {
    if (r < 0.22) {
      await hmCoffee(a);
    } else if (a.id !== 'me' && r < 0.38 && !hmActors.me.busy && hmActors.me.floor === HM_ROOM.boss) {
      // 搭電梯上頂樓找老闆報告
      const boss = hmActors.me;
      boss.busy = true;
      try {
        await hmGo(a.id, ({ book: 'meetBook', chart: 'meetChart', stock: 'meetStock', xfer: 'meetXfer' })[a.id]);
        hmFace(a, boss);
        await hmChat(hmReport(a.id, d));
      } finally { boss.busy = false; boss.figEl.classList.remove('flip'); }
      await hmGo(a.id, a.seat);
    } else if (r < 0.56 && await hmVisit(a)) {
      // 已經去找人聊完了
    } else if (a.id === 'me' && r < 0.72) {
      // 老闆巡樓：看白板、看盤、窗邊、沙發、公告欄、ATM
      const where = pk(['board', 'monitor', 'window', 'sofa', 'notice', 'vault', 'atm', 'guide']);
      await hmGo('me', where);
      const text = {
        board: d.cats[0] ? `原來${catText(d.cats[0][0])}花最多…` : '白板好乾淨 ✨',
        monitor: d.stockBal != null ? `股票帳戶 ${hmShortMoney(d.stockBal)}…穩住 📈` : '看一下盤 📈',
        window: hmNight() ? '夜景好美 🌃' : '今天天氣不錯 🌤️', sofa: '休息一下～ 🛋️', guide: '大樓越來越熱鬧了 🏢',
        atm: d.xfers.length ? `這個月轉了 ${hmShortMoney(d.xferTotal)}，錢有到位 🏧` : '來 ATM 看看餘額 🏧', notice: d.latest ? `最新一筆是「${d.latest.item}」` : '公告欄空空的 📌', vault: d.inc - d.exp >= 0 ? '小豬撲滿又變胖了 🐷' : '撲滿要節食了 🐷',
      }[where];
      hmSay('me', text, 3200);
      a.el.classList.add(where === 'sofa' ? 'rest' : 'happy');
      const mate = Object.values(hmActors).find(x => x !== a && x.floor === a.floor && !x.busy);
      await hmWait(2400);
      if (mate) { hmFace(a, mate); hmSay(mate.id, pk(['老闆好！👋', '老闆來巡視了 😳', '老闆要喝咖啡嗎 ☕']), 2200); await hmWait(1600); }
      a.el.classList.remove('rest', 'happy');
      await hmGo('me', 'me');
    } else if (a.id !== 'me' && r < 0.75) {
      // 小幫手在自己樓層走動做事
      const near = { book: ['cabinet', 'notice'], chart: ['board', 'shelf'], stock: ['monitor', 'vault'], xfer: ['tube', 'atm', 'lockers'] }[a.id];
      const where = pk(near);
      await hmGo(a.id, where);
      hmSay(a.id, {
        cabinet: '把發票收進檔案櫃 🗄️', notice: '把最新的帳貼上公告欄 📌',
        board: '把白板的數字更新一下 ✏️', shelf: '翻一下上個月的報表 📚', monitor: '盯盤中…綠油油的別嚇我 😵', vault: '數數存錢筒 🐷',
        tube: '用氣送管把轉帳單送出去 🚀', atm: '確認一下 ATM 有沒有入帳 🏧', lockers: '核對各帳戶的餘額 🗂️',
      }[where], 2800);
      a.el.classList.add('happy');
      await hmWait(2600);
      a.el.classList.remove('happy');
      await hmGo(a.id, a.seat);
    } else {
      hmSay(a.id, hmLine(a.id, d));
      a.el.classList.add('happy');
      await hmWait(1200);
      a.el.classList.remove('happy');
    }
  } finally { a.busy = false; a.figEl.classList.remove('flip'); }
}

// ── 大樓畫面 ─────────────────────────────────────────────────
// 畫法參考共同帳本的辦公室：粉嫩色牆面、木頭樓板、每層一扇電梯門、街道與馬路
function hmT(s, n) { const a = [...String(s || '')]; return esc(a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('')); }
const HM_WALL = Object.fromEntries(Object.entries({ xfer: ['#f1ecfb', '#d9cfee', '#e6def6'], stock: ['#e9f2fc', '#c9d9ec', '#dce8f6'], chart: ['#fff4e2', '#e8d2b0', '#f8e8cf'], boss: ['#fdebf1', '#efcbd8', '#f8dbe5'], book: ['#e9f6f0', '#c4e2d4', '#d9efe4'], lobby: ['#fbf3e6', '#e6cfae', '#f3e3cb'] }).map(([k, v]) => [HM_ROOM[k], v]));
// 盆栽（同共同帳本的葉子畫法）
function hmPlant(cx, fl, k = 1, flower = false) {
  return `<g transform="translate(${cx} ${fl}) scale(${k})">
    <ellipse cx="0" cy="0" rx="26" ry="5" fill="rgba(90,70,50,.12)"/>
    <g class="hb-leaf"><g transform="translate(0 -36)">
      <path d="M0 0 Q-26 -18 -22 -54 Q-2 -40 0 0 Z" fill="#8fd3b0"/><path d="M0 0 Q26 -20 26 -58 Q4 -42 0 0 Z" fill="#a8e0c0"/>
      <path d="M0 0 Q-8 -40 4 -72 Q12 -38 0 0 Z" fill="#7cc7a0"/><path d="M0 -6 Q-30 -10 -38 -34 Q-14 -30 0 -6 Z" fill="#9fdcb8"/>
      <path d="M0 -4 Q-12 -30 -18 -48 M0 -4 Q12 -32 20 -52" stroke="#6fb592" stroke-width="1.6" fill="none" opacity=".6"/>
      ${flower ? [[-22, -54], [26, -58], [4, -72]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#f7a8c0"/><circle cx="${x}" cy="${y}" r="2.8" fill="#ffd66b"/>`).join('') : ''}</g></g>
    <path d="M-20 -36 h40 l-5 34 q-15 5 -30 0 Z" fill="#f4b99a"/><rect x="-23" y="-40" width="46" height="9" rx="4" fill="#e8a283"/><path d="M-14 -24 h28" stroke="#fff" stroke-width="2" opacity=".35"/></g>`;
}
// 窗戶：白框、十字窗格、窗台；白天有反光，晚上有星星
function hmWin(x, y, w, h, night, curtain) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${night ? '#2a3366' : '#cfe8fa'}"/>
    ${night ? `<circle cx="${x + w - 30}" cy="${y + 26}" r="12" fill="#fff6d6"/><circle cx="${x + w - 24}" cy="${y + 21}" r="10" fill="#2a3366"/><circle cx="${x + 22}" cy="${y + 20}" r="2.4" fill="#fff6d6"/><circle cx="${x + 60}" cy="${y + 44}" r="2" fill="#fff6d6"/>`
      : `<ellipse cx="${x + w * 0.3}" cy="${y + h * 0.32}" rx="${w * 0.16}" ry="7" fill="#fff" opacity=".9"/><path d="M${x} ${y + h * 0.78} q${w * 0.25} -22 ${w * 0.5} -4 t${w * 0.5} -8 V${y + h} H${x} Z" fill="#a8d8b8" opacity=".8"/>`}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="#fff" stroke-width="7"/>
    <path d="M${x + w / 2} ${y} v${h} M${x} ${y + h / 2} h${w}" stroke="#fff" stroke-width="5"/>
    ${night ? '' : `<path d="M${x + 14} ${y + h - 20} l26 -42 M${x + w / 2 + 14} ${y + h - 16} l18 -30" stroke="#fff" stroke-width="5" opacity=".55"/>`}
    <rect x="${x - 10}" y="${y + h + 2}" width="${w + 20}" height="9" rx="4" fill="#e3cbb0"/>
    ${curtain ? `<path d="M${x - 16} ${y - 14} h34 q-6 ${h * 0.5} 6 ${h + 10} h-36 Z" fill="${curtain}"/><path d="M${x + w + 16} ${y - 14} h-34 q6 ${h * 0.5} -6 ${h + 10} h36 Z" fill="${curtain}"/>
      <rect x="${x - 24}" y="${y - 20}" width="${w + 48}" height="8" rx="4" fill="#c99a6a"/><circle cx="${x - 24}" cy="${y - 16}" r="6" fill="#b98a5c"/><circle cx="${x + w + 24}" cy="${y - 16}" r="6" fill="#b98a5c"/>` : ''}`;
}
// 側面的桌子（桌面、亮邊、桌腳），可加抽屜櫃
function hmDesk(x, w, fl, top = '#e3b98a', leg = '#c99a6a', drawer = false) {
  return `<ellipse cx="${x + w / 2}" cy="${fl}" rx="${w / 2 + 6}" ry="6" fill="rgba(90,70,50,.12)"/>
    <rect x="${x}" y="${fl - 86}" width="${w}" height="22" rx="6" fill="${top}"/><rect x="${x + 4}" y="${fl - 86}" width="${w - 8}" height="5" rx="2.5" fill="#fff" opacity=".35"/>
    <rect x="${x + 10}" y="${fl - 64}" width="14" height="64" fill="${leg}"/>
    ${drawer ? `<rect x="${x + w - 84}" y="${fl - 64}" width="70" height="64" rx="4" fill="${leg}"/>
      <rect x="${x + w - 78}" y="${fl - 58}" width="58" height="24" rx="3" fill="${top}"/><rect x="${x + w - 78}" y="${fl - 30}" width="58" height="24" rx="3" fill="${top}"/>
      <rect x="${x + w - 58}" y="${fl - 49}" width="18" height="5" rx="2.5" fill="#8a6a4f"/><rect x="${x + w - 58}" y="${fl - 21}" width="18" height="5" rx="2.5" fill="#8a6a4f"/>`
      : `<rect x="${x + w - 24}" y="${fl - 64}" width="14" height="64" fill="${leg}"/>`}`;
}
// 辦公椅（椅背、坐墊、氣壓桿、五爪輪）
function hmChair(x, fl, c = '#7fb6f0', c2 = '#5f96d0', high = false) {
  const bt = high ? 136 : 118;
  return `<rect x="${x - 24}" y="${fl - bt}" width="48" height="${bt - 62}" rx="14" fill="${c}"/><rect x="${x - 16}" y="${fl - bt + 8}" width="32" height="${bt - 82}" rx="10" fill="#fff" opacity=".18"/>
    <rect x="${x - 4}" y="${fl - 64}" width="8" height="10" fill="#7d8a99"/>
    <rect x="${x - 28}" y="${fl - 60}" width="56" height="13" rx="6" fill="${c2}"/>
    <rect x="${x - 3}" y="${fl - 47}" width="6" height="26" fill="#9aa8b6"/>
    <path d="M${x - 26} ${fl - 10} L${x} ${fl - 22} L${x + 26} ${fl - 10}" stroke="#7d8a99" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="${x - 26}" cy="${fl - 5}" r="5" fill="#5b6475"/><circle cx="${x + 26}" cy="${fl - 5}" r="5" fill="#5b6475"/><circle cx="${x}" cy="${fl - 6}" r="4" fill="#5b6475"/>`;
}
// 螢幕（外框、畫面、反光）
function hmMon(x, y, w, h, inner, stand = 0) {
  return `${stand ? `<rect x="${x + w / 2 - 6}" y="${y + h}" width="12" height="${stand}" fill="#5b6475"/><rect x="${x + w / 2 - 20}" y="${y + h + stand - 4}" width="40" height="6" rx="3" fill="#5b6475"/>` : ''}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#3e4a5a"/><rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="4" fill="#1f2a3a"/>
    ${inner}<path d="M${x + 12} ${y + h - 14} l${Math.min(40, w * 0.3)} -${h * 0.6}" stroke="#fff" stroke-width="6" opacity=".07"/>
    <circle cx="${x + w - 12}" cy="${y + h - 9}" r="2" fill="#8fd3b0"/>`;
}
function hmMug(x, fl, c = '#fff') {
  return `<path d="M${x - 9} ${fl - 18} h18 l-2 18 h-14 Z" fill="${c}" stroke="#d9c7b0" stroke-width="2"/><path d="M${x + 9} ${fl - 14} q8 0 7 6 q-1 5 -9 4" fill="none" stroke="#d9c7b0" stroke-width="2.2"/>
    <path class="hb-steam" d="M${x - 3} ${fl - 22} q-4 -6 0 -12 M${x + 4} ${fl - 22} q4 -6 0 -12" fill="none" stroke="#c5d2de" stroke-width="2.2" stroke-linecap="round"/>`;
}
function hmDrawBuilding(d) {
  const night = hmNight();
  const now = new Date();
  const T = HM_FT, FL = hmFL;
  const TOP = T[6], BOT = T[1] + HM_FH;
  const P = [];
  const sky = night ? ['#1b2150', '#3b3f72'] : now.getHours() >= 16 ? ['#ffb79a', '#ffe8cc'] : ['#bfe3ff', '#fff3e0'];
  const cloud = (x, y, k) => `<g fill="#fff" opacity=".95"><ellipse cx="${x}" cy="${y}" rx="${70 * k}" ry="${22 * k}"/><ellipse cx="${x - 40 * k}" cy="${y - 14 * k}" rx="${40 * k}" ry="${26 * k}"/><ellipse cx="${x + 30 * k}" cy="${y - 10 * k}" rx="${34 * k}" ry="${22 * k}"/></g>`;
  P.push(`<defs><linearGradient id="hbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
    <linearGradient id="hbGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7d77a"/><stop offset=".5" stop-color="#e0a82e"/><stop offset="1" stop-color="#f2c75c"/></linearGradient>
    <linearGradient id="hbGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3f3fb"/><stop offset="1" stop-color="#b9dcec"/></linearGradient>
    <clipPath id="hbTick"><rect x="278" y="${T[HM_ROOM.stock] + 16}" width="534" height="36" rx="6"/></clipPath></defs>
    <rect width="${HM_W}" height="${HM_H}" fill="url(#hbSky)"/>`);
  // 太陽／月亮、遠方的城市、雲、鳥
  P.push(night
    ? `<circle cx="780" cy="52" r="28" fill="#fff6d6"/><circle cx="792" cy="43" r="24" fill="#1b2150"/>${[[300, 30], [420, 64], [700, 24], [860, 58], [560, 46], [240, 80], [950, 30]].map(([x, y]) => `<circle class="hb-twinkle" cx="${x}" cy="${y}" r="2.6" fill="#fff6d6"/>`).join('')}`
    : `<circle cx="110" cy="58" r="52" fill="#ffd66b" opacity=".25"/><circle cx="110" cy="58" r="36" fill="${now.getHours() >= 16 ? '#ff9a6b' : '#ffd66b'}"/>${cloud(700, 62, 0.9)}${cloud(380, 44, 0.6)}
      <g fill="none" stroke="#5b6475" stroke-width="2.4" stroke-linecap="round"><path d="M520 90 q8 -8 16 0 q8 -8 16 0"/><path d="M570 70 q6 -6 12 0 q6 -6 12 0"/></g>`);
  P.push(`<g fill="${night ? '#2c3363' : '#c9dcee'}" opacity=".9"><rect x="0" y="${TOP - 90}" width="70" height="90"/><rect x="80" y="${TOP - 60}" width="60" height="60"/><rect x="890" y="${TOP - 110}" width="60" height="110"/><rect x="955" y="${TOP - 70}" width="45" height="70"/></g>
    ${night ? [[20, 70], [100, 40], [905, 90], [930, 60], [965, 40]].map(([x, y]) => `<rect x="${x}" y="${TOP - y}" width="9" height="11" fill="#ffd66b" opacity=".8"/>`).join('') : ''}`);
  // 屋頂：屋簷、招牌（含燈泡）、天線、太陽能板、水塔
  P.push(`<rect x="20" y="${TOP - 34}" width="960" height="40" rx="10" fill="#b98a5c"/><rect x="20" y="${TOP - 34}" width="960" height="8" rx="4" fill="#d9b48a"/>
    <g transform="translate(60 ${TOP - 34})"><rect x="30" y="-46" width="10" height="46" fill="#9aa8b6"/><rect x="110" y="-46" width="10" height="46" fill="#9aa8b6"/><path d="M0 -44 L28 -84 H152 L124 -44 Z" fill="#3f5f94"/><path d="M41 -84 L13 -44 M72 -84 L44 -44 M103 -84 L75 -44 M134 -84 L106 -44 M14 -64 H138" stroke="#9fc0ea" stroke-width="2"/><path d="M30 -82 L22 -70" stroke="#fff" stroke-width="3" opacity=".5"/></g>
    <g transform="translate(860 ${TOP - 34})"><rect x="-4" y="-120" width="8" height="120" fill="#7d8a99"/><path d="M-22 -96 h44 M-16 -76 h32" stroke="#7d8a99" stroke-width="4" stroke-linecap="round"/><circle class="hb-blink" cy="-126" r="8" fill="#ef5f7a"/></g>
    <g transform="translate(240 ${TOP - 34})"><rect x="-30" y="-56" width="60" height="50" rx="10" fill="#9fd0f0"/><rect x="-30" y="-56" width="60" height="12" rx="6" fill="#7fb6f0"/><path d="M-22 -36 h44 M-22 -24 h44" stroke="#7fb6f0" stroke-width="2"/><rect x="-24" y="-6" width="6" height="6" fill="#7d8a99"/><rect x="18" y="-6" width="6" height="6" fill="#7d8a99"/></g>
    <rect x="300" y="${TOP - 104}" width="460" height="64" rx="16" fill="#fff" stroke="#7fd6d8" stroke-width="6"/>
    <rect x="312" y="${TOP - 94}" width="436" height="44" rx="10" fill="none" stroke="#c9eeee" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>
    <text x="530" y="${TOP - 61}" font-size="40" font-weight="800" text-anchor="middle" fill="#0a7c80" letter-spacing="2">📒 我的帳本大樓</text>
    <path d="M360 ${TOP - 40} v6 M700 ${TOP - 40} v6" stroke="#9aa8b6" stroke-width="6"/>
    ${night ? `<ellipse cx="530" cy="${TOP - 72}" rx="250" ry="44" fill="#bff3f3" opacity=".18"/>` : ''}`);
  // 外牆
  P.push(`<rect x="20" y="${TOP}" width="960" height="${BOT - TOP}" fill="#e6d3bd"/>`);
  // 各樓層：牆、腰板、地板、樓板、天花燈、樓層牌
  [6, 5, 4, 3, 2, 1].forEach(f => {
    const w = HM_WALL[f], fl = FL(f), t = T[f];
    P.push(`<rect x="36" y="${t + 8}" width="790" height="${fl - t - 8}" rx="8" fill="${w[0]}"/>
      <rect x="36" y="${fl - 64}" width="790" height="64" fill="${w[2]}"/><rect x="36" y="${fl - 68}" width="790" height="6" fill="#fff" opacity=".7"/>
      <rect x="36" y="${fl}" width="790" height="8" fill="${w[1]}"/><rect x="20" y="${fl + 8}" width="960" height="12" fill="#b98a5c"/><rect x="20" y="${fl + 8}" width="960" height="3" fill="#d9b48a"/>
      ${[230, 520].map(x => `<path d="M${x} ${t + 8} v14" stroke="#9aa8b6" stroke-width="2"/><path d="M${x - 22} ${t + 36} q22 -22 44 0 Z" fill="#fff6d6" stroke="#e0c99a" stroke-width="2"/>${night ? `<ellipse cx="${x}" cy="${t + 70}" rx="70" ry="40" fill="#fff3c0" opacity=".22"/>` : ''}`).join('')}
      <rect x="44" y="${t + 12}" width="${[...HM_FLOOR_NAME[f]].length * 25 + 26}" height="42" rx="21" fill="#fff" opacity=".94"/>
      <text x="${44 + ([...HM_FLOOR_NAME[f]].length * 25 + 26) / 2}" y="${t + 42}" font-size="26" font-weight="800" text-anchor="middle" fill="#6b5a4c">${HM_FLOOR_NAME[f]}</text>`);
  });

  // ── 轉帳中心（4F）：氣送管、轉帳路線看板、轉帳櫃台、ATM、帳戶保管箱 ──
  let t = T[HM_ROOM.xfer], fl = FL(HM_ROOM.xfer);
  const rts = d.routes.slice(0, 3);
  const rtRows = rts.map(([k, v], i) => {
    const [from, to] = k.split('→');
    return `<g transform="translate(0 ${i * 30})"><rect x="244" y="${t + 92}" width="306" height="27" rx="4" fill="${i % 2 ? '#232c3b' : '#1c2433'}"/>
      <text x="250" y="${t + 112}" font-size="18" font-weight="700" fill="#ffd66b">${hmT(from, 4)}</text>
      <text x="340" y="${t + 112}" font-size="18" fill="#7fd6e6" text-anchor="middle">➜</text>
      <text x="356" y="${t + 112}" font-size="18" font-weight="700" fill="#c9a0e6">${hmT(to, 4)}</text>
      <text x="544" y="${t + 112}" font-size="18" font-weight="700" fill="#fff" text-anchor="end" font-family="monospace">${hmShortMoney(v)}</text></g>`;
  }).join('') || `<text x="397" y="${t + 130}" text-anchor="middle" font-size="20" fill="#7d8a99">這個月還沒有轉帳</text>`;
  const lockers = [0, 1, 2, 3].map(i => {
    const a = d.accBal[i], x = 656 + (i % 2) * 76, y = fl - 196 + Math.floor(i / 2) * 92;
    return `<rect x="${x}" y="${y}" width="68" height="84" rx="6" fill="#dfe5eb" stroke="#9aa8b6" stroke-width="2"/><rect x="${x + 6}" y="${y + 8}" width="56" height="20" rx="3" fill="#fff"/>
      <text x="${x + 34}" y="${y + 23}" text-anchor="middle" font-size="14" font-weight="800" fill="#5b6475">${a ? hmT(a[0], 4) : '空'}</text>
      <text x="${x + 34}" y="${y + 50}" text-anchor="middle" font-size="16" font-weight="800" fill="${a && a[1] < 0 ? '#16a34a' : '#8a5fb5'}">${a ? hmShortMoney(a[1]) : '—'}</text>
      <circle cx="${x + 34}" cy="${y + 68}" r="6" fill="#c5d0db" stroke="#7d8a99" stroke-width="2"/><rect x="${x + 33}" y="${y + 64}" width="2" height="5" fill="#7d8a99"/>`;
  }).join('');
  const lx = d.latestXfer;
  P.push(`<g><path id="hbTubeP" d="M84 ${fl - 70} V${t + 96} Q84 ${t + 76} 104 ${t + 76} H176 Q196 ${t + 76} 196 ${t + 96} V${fl - 70}" fill="none" stroke="#bfe8f0" stroke-width="26" stroke-linecap="round" opacity=".75"/>
      <path d="M84 ${fl - 70} V${t + 96} Q84 ${t + 76} 104 ${t + 76} H176 Q196 ${t + 76} 196 ${t + 96} V${fl - 70}" fill="none" stroke="#fff" stroke-width="5" opacity=".7" transform="translate(-6 0)"/>
      ${[t + 120, t + 170].map(y => `<rect x="68" y="${y}" width="32" height="8" rx="3" fill="#9aa8b6"/><rect x="180" y="${y}" width="32" height="8" rx="3" fill="#9aa8b6"/>`).join('')}
      <g><rect x="-9" y="-16" width="18" height="32" rx="9" fill="#ffd66b" stroke="#e0a82e" stroke-width="2"/><rect x="-9" y="-3" width="18" height="6" fill="#ef7d9a"/>
        <animateMotion dur="5s" repeatCount="indefinite" keyPoints="0;1;1;0;0" keyTimes="0;.4;.5;.9;1" calcMode="linear"><mpath href="#hbTubeP"/></animateMotion></g>
      ${[84, 196].map(x => `<rect x="${x - 26}" y="${fl - 74}" width="52" height="74" rx="8" fill="#c5d0db"/><rect x="${x - 20}" y="${fl - 66}" width="40" height="30" rx="5" fill="#e9f6fb"/><rect x="${x - 26}" y="${fl - 30}" width="52" height="6" fill="#9aa8b6"/><circle cx="${x}" cy="${fl - 14}" r="4" fill="${x < 100 ? '#8fd3b0' : '#ef7d7d'}"/>`).join('')}
      <text x="84" y="${fl - 46}" text-anchor="middle" font-size="15" font-weight="800" fill="#5b6475">送出</text><text x="196" y="${fl - 46}" text-anchor="middle" font-size="15" font-weight="800" fill="#5b6475">收件</text></g>
    <g><rect x="234" y="${t + 46}" width="326" height="${Math.max(2, rts.length) * 30 + 58}" rx="10" fill="#2f3845"/><rect x="240" y="${t + 52}" width="314" height="${Math.max(2, rts.length) * 30 + 46}" rx="6" fill="#141b26"/>
      <text x="250" y="${t + 80}" font-size="20" font-weight="800" fill="#7fd6e6">🔁 本月轉帳</text>
      <text x="546" y="${t + 80}" font-size="17" font-weight="700" fill="#9aa8b6" text-anchor="end">${d.xfers.length} 筆 · ${hmShortMoney(d.xferTotal)}</text>${rtRows}
      ${[300, 490].map(x => `<rect x="${x - 3}" y="${t + 36}" width="6" height="12" fill="#7d8a99"/>`).join('')}</g>
    ${hmChair(400, fl, '#c9a0e6', '#a984cf')}
    <ellipse cx="410" cy="${fl}" rx="120" ry="6" fill="rgba(90,70,50,.12)"/>
    <rect x="296" y="${fl - 96}" width="228" height="16" rx="6" fill="#f8e1f0"/><rect x="300" y="${fl - 96}" width="220" height="4" rx="2" fill="#fff" opacity=".6"/>
    <rect x="304" y="${fl - 80}" width="212" height="80" rx="6" fill="#c9a0e6"/><rect x="304" y="${fl - 80}" width="212" height="12" fill="#b48ad9"/>
    <circle cx="410" cy="${fl - 36}" r="18" fill="#fff"/><text x="410" y="${fl - 29}" text-anchor="middle" font-size="18">🔁</text>
    <g transform="translate(330 ${fl - 96})"><rect x="-22" y="-4" width="44" height="4" fill="#fff" stroke="#d9c7b0" stroke-width="1"/><rect x="-20" y="-8" width="40" height="5" fill="#fff" stroke="#d9c7b0" stroke-width="1"/>
      <text x="0" y="-10" text-anchor="middle" font-size="7" fill="#8a5fb5">轉帳單</text></g>
    <g transform="translate(372 ${fl - 96})"><rect x="-12" y="-2" width="24" height="2" rx="1" fill="#ef5f7a" opacity=".5"/><g class="hb-stamp"><rect x="-6" y="-26" width="12" height="16" rx="5" fill="#8a5a3b"/><rect x="-11" y="-12" width="22" height="10" rx="3" fill="#ef5f7a"/></g></g>
    <g transform="translate(470 ${fl - 96})"><rect x="-30" y="-40" width="60" height="40" rx="5" fill="#5b6475"/><rect x="-25" y="-35" width="50" height="22" rx="3" fill="#1f2a3a"/>
      <text x="0" y="-18" text-anchor="middle" font-size="12" font-weight="800" fill="#7fffd0">${lx ? hmShortMoney(lx.transfer) : '待命'}</text>
      ${[0, 1, 2].map(i => `<rect x="${-22 + i * 16}" y="-10" width="12" height="6" rx="2" fill="${['#8fd3b0', '#ffd66b', '#ef7d7d'][i]}"/>`).join('')}</g>
    <g transform="translate(600 ${fl})"><ellipse cx="0" cy="0" rx="42" ry="5" fill="rgba(90,70,50,.14)"/>
      <rect x="-36" y="-176" width="72" height="176" rx="8" fill="#5f9ee6"/><rect x="-36" y="-176" width="72" height="26" rx="8" fill="#3f78bd"/><text x="0" y="-156" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">ATM</text>
      <rect x="-26" y="-142" width="52" height="40" rx="4" fill="#1f2a3a"/><text x="0" y="-126" text-anchor="middle" font-size="12" fill="#9aa8b6">總餘額</text>
      <text x="0" y="-108" text-anchor="middle" font-size="14" font-weight="800" fill="#7fffd0">${d.cashTotal != null ? hmShortMoney(d.cashTotal) : '***'}</text>
      <rect x="-26" y="-94" width="52" height="30" rx="4" fill="#dfe5eb"/>${[...Array(9)].map((_, i) => `<rect x="${-22 + (i % 3) * 16}" y="${-91 + Math.floor(i / 3) * 9}" width="12" height="6" rx="1.5" fill="#9aa8b6"/>`).join('')}
      <rect x="-20" y="-56" width="40" height="6" rx="3" fill="#1f2a3a"/><rect x="-14" y="-52" width="28" height="12" rx="2" fill="#a8e0c0" class="hb-cash"/>
      <rect x="-30" y="-30" width="60" height="24" rx="4" fill="#3f78bd"/></g>
    <g><ellipse cx="730" cy="${fl}" rx="84" ry="6" fill="rgba(90,70,50,.12)"/><rect x="648" y="${fl - 206}" width="164" height="206" rx="8" fill="#9aa8b6"/>${lockers}
      <rect x="662" y="${fl - 238}" width="136" height="28" rx="8" fill="#8a5fb5"/><text x="730" y="${fl - 218}" text-anchor="middle" font-size="17" font-weight="800" fill="#fff">各帳戶餘額</text></g>`);

  // ── 股票交易室（3F）：跑馬燈、三台壁掛螢幕、交易桌、保險箱 ──
  t = T[HM_ROOM.stock]; fl = FL(HM_ROOM.stock);
  const candles = [...Array(9)].map((_, i) => {
    const up = (i * 5 + 2) % 3 !== 0, h = 12 + (i * 13) % 22, x = 414 + i * 20, top = t + 100 - (i * 7) % 24 - i * 2;
    return `<path d="M${x + 5} ${top - 8} v${h + 16}" stroke="${up ? '#f87171' : '#4ade80'}" stroke-width="2"/><rect x="${x}" y="${top}" width="10" height="${h}" rx="1.5" fill="${up ? '#f87171' : '#4ade80'}"/>`;
  }).join('');
  const sb = d.stockBal != null ? hmShortMoney(d.stockBal) : '…';
  P.push(`<rect x="272" y="${t + 12}" width="546" height="44" rx="10" fill="#2f3845"/><rect x="278" y="${t + 16}" width="534" height="36" rx="6" fill="#141b26"/>
    <g clip-path="url(#hbTick)"><text y="${t + 43}" font-size="24" font-weight="700" fill="#ffd66b" font-family="monospace">
      <tspan x="282">📈 股票帳戶 ${sb}　💰 今年股息 ${hmShortMoney(d.divYear)}　🐢 長期投資　📒 本月結餘 ${hmShortMoney(d.inc - d.exp)}</tspan>
      <animate attributeName="x" from="812" to="-640" dur="18s" repeatCount="indefinite"/></text></g>
    ${[].map(x => `<circle cx="${x - 14}" cy="${t + 35}" r="3" fill="#ef5f7a" class="hb-blink"/>`).join('')}
    ${hmMon(226, t + 62, 160, 84, `<path d="M236 ${t + 126} h140 M236 ${t + 100} h140" stroke="#33415a" stroke-width="1"/>
      <path d="M240 ${t + 130} L266 ${t + 114} L290 ${t + 120} L316 ${t + 96} L342 ${t + 102} L372 ${t + 80} V${t + 138} H240 Z" fill="#f87171" opacity=".18"/>
      <polyline points="240,${t + 130} 266,${t + 114} 290,${t + 120} 316,${t + 96} 342,${t + 102} 372,${t + 80}" fill="none" stroke="#f87171" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="372" cy="${t + 80}" r="5" fill="#fca5a5"/>`)}
    ${hmMon(400, t + 58, 200, 90, `<text x="410" y="${t + 76}" font-size="15" fill="#7d8a99" font-family="monospace">日K</text>${candles}`)}
    ${hmMon(614, t + 62, 160, 84, `<text x="694" y="${t + 88}" text-anchor="middle" font-size="19" font-weight="700" fill="#9aa8b6">股票帳戶</text>
      <text x="694" y="${t + 118}" text-anchor="middle" font-size="32" font-weight="800" fill="${d.stockBal != null && d.stockBal < 0 ? '#4ade80' : '#fca5a5'}">${sb}</text>
      <text x="694" y="${t + 139}" text-anchor="middle" font-size="16" fill="#9aa8b6">股息 ${hmShortMoney(d.divYear)}</text>`)}
    ${[306, 500, 694].map(x => `<rect x="${x - 3}" y="${t + 52}" width="6" height="8" fill="#7d8a99"/>`).join('')}
    ${hmChair(330, fl, '#7fb6f0', '#5f96d0')}
    ${hmDesk(250, 330, fl, '#cfd8e3', '#9aa8b6', true)}
    ${hmMon(268, fl - 130, 76, 38, `<path d="M276 ${fl - 100} l14 -8 12 5 14 -11 14 6" fill="none" stroke="#f87171" stroke-width="3" stroke-linecap="round"/>`, 6)}
    ${hmMon(352, fl - 130, 76, 38, `<rect x="362" y="${fl - 122}" width="56" height="4" rx="2" fill="#4ade80"/><rect x="362" y="${fl - 114}" width="40" height="4" rx="2" fill="#f87171"/><rect x="362" y="${fl - 106}" width="48" height="4" rx="2" fill="#f87171"/>`, 6)}
    <rect x="440" y="${fl - 92}" width="60" height="7" rx="3" fill="#5b6475"/><path d="M444 ${fl - 89} h52" stroke="#9aa8b6" stroke-width="2" stroke-dasharray="3 2"/>
    ${hmMug(530, fl - 86, '#fde0e9')}
    <g transform="translate(690 ${fl})"><ellipse cx="0" cy="0" rx="50" ry="6" fill="rgba(90,70,50,.14)"/>
      <rect x="-44" y="-98" width="88" height="96" rx="10" fill="#7d8a99"/><rect x="-44" y="-98" width="88" height="10" rx="5" fill="#9aa8b6"/>
      <rect x="-36" y="-84" width="72" height="72" rx="6" fill="#9aa8b6" stroke="#6b7684" stroke-width="2"/>
      <circle cx="-4" cy="-48" r="20" fill="#c5d0db" stroke="#6b7684" stroke-width="3"/><circle cx="-4" cy="-48" r="5" fill="#6b7684"/>
      <path d="M-4 -66 v6 M-4 -36 v6 M-22 -48 h6 M10 -48 h6" stroke="#6b7684" stroke-width="2"/><rect x="24" y="-60" width="6" height="24" rx="3" fill="#e0a82e"/>
      <rect x="-40" y="-4" width="10" height="4" fill="#5b6475"/><rect x="30" y="-4" width="10" height="4" fill="#5b6475"/>
      ${[0, 1, 2, 3].map(i => `<ellipse cx="${-20 + (i % 2) * 2}" cy="${-104 - i * 6}" rx="15" ry="5" fill="${i % 2 ? '#ffd66b' : '#f2b632'}"/>`).join('')}
      <ellipse cx="18" cy="-104" rx="15" ry="5" fill="#f2b632"/><ellipse cx="18" cy="-110" rx="15" ry="5" fill="#ffd66b"/></g>
    ${hmPlant(786, fl, 0.9)}`);

  // ── 分析室（2F）：白板（長條圖＋圓餅）、時鐘、書櫃、辦公桌 ──
  t = T[HM_ROOM.chart]; fl = FL(HM_ROOM.chart);
  const cats = d.cats.slice(0, 4);
  const cmax = cats.length ? cats[0][1] : 1;
  const colors = ['#f79aae', '#ffb86b', '#7fd6e6', '#8fd3b0'];
  const bars = cats.map(([n, v], i) => `<text x="254" y="${t + 92 + i * 28}" font-size="21" font-weight="700" fill="#5b6475">${hmT(catText(n), 5)}</text>
    <rect x="370" y="${t + 78 + i * 28}" width="90" height="16" rx="8" fill="#eef1f4"/><rect x="370" y="${t + 78 + i * 28}" width="${Math.max(12, 90 * v / cmax).toFixed(0)}" height="16" rx="8" fill="${colors[i]}"/>
    <path d="M375 ${t + 82 + i * 28} h${Math.max(4, 90 * v / cmax - 12).toFixed(0)}" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>
    <text x="528" y="${t + 92 + i * 28}" font-size="19" font-weight="700" text-anchor="end" fill="#6b7482">${d.exp ? Math.round(v / d.exp * 100) : 0}%</text>`).join('')
    || `<text x="446" y="${t + 128}" text-anchor="middle" font-size="26" fill="#a8978a">還沒有支出 ✏️</text>`;
  let acc = 0;
  const pcx = 590, pcy = t + 120, pr = 50;
  const pie = d.exp ? d.cats.map(([, v], i) => {
    const a0 = acc / d.exp * Math.PI * 2 - Math.PI / 2; acc += v; const a1 = acc / d.exp * Math.PI * 2 - Math.PI / 2;
    if (a1 - a0 > 6.28) return `<circle cx="${pcx}" cy="${pcy}" r="${pr}" fill="${colors[0]}"/>`;
    return `<path d="M${pcx} ${pcy} L${(pcx + pr * Math.cos(a0)).toFixed(1)} ${(pcy + pr * Math.sin(a0)).toFixed(1)} A${pr} ${pr} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${(pcx + pr * Math.cos(a1)).toFixed(1)} ${(pcy + pr * Math.sin(a1)).toFixed(1)} Z" fill="${i < 4 ? colors[i] : '#d9dee5'}" stroke="#fff" stroke-width="2"/>`;
  }).join('') : '';
  const ang = (now.getHours() % 12 + now.getMinutes() / 60) * 30, mang = now.getMinutes() * 6;
  P.push(`<rect x="236" y="${t + 48}" width="420" height="150" rx="10" fill="#c3ccd6"/><rect x="239" y="${t + 51}" width="414" height="144" rx="8" fill="#dfe5eb"/><rect x="245" y="${t + 57}" width="402" height="128" rx="5" fill="#fff" stroke="#e6ebf0" stroke-width="2"/>
    <path d="M252 ${t + 64} h26" stroke="#f3f5f8" stroke-width="5" stroke-linecap="round"/>
    <rect x="356" y="${t + 34}" width="180" height="28" rx="8" fill="#9aa8b6"/><text x="446" y="${t + 54}" font-size="19" font-weight="700" text-anchor="middle" fill="#fff">本月支出分析</text>
    <circle cx="251" cy="${t + 63}" r="5" fill="#ef7d7d"/><circle cx="637" cy="${t + 63}" r="5" fill="#7fb6f0"/>
    ${bars}${d.exp ? `<circle cx="${pcx}" cy="${pcy}" r="${pr + 3}" fill="#eef1f4"/>${pie}<circle cx="${pcx}" cy="${pcy}" r="25" fill="#fff"/><text x="${pcx}" y="${pcy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#7b8094">${hmShortMoney(d.exp)}</text>` : ''}
    <rect x="270" y="${t + 196}" width="350" height="9" rx="4" fill="#aeb9c4"/>
    <rect x="286" y="${t + 190}" width="26" height="7" rx="3.5" fill="#ef5f7a"/><rect x="286" y="${t + 190}" width="7" height="7" rx="2" fill="#c2405b"/>
    <rect x="318" y="${t + 190}" width="26" height="7" rx="3.5" fill="#5f9ee6"/><rect x="318" y="${t + 190}" width="7" height="7" rx="2" fill="#3f78bd"/>
    <rect x="350" y="${t + 190}" width="26" height="7" rx="3.5" fill="#49b07f"/><rect x="350" y="${t + 190}" width="7" height="7" rx="2" fill="#2f8a5e"/>
    <rect x="540" y="${t + 188}" width="34" height="10" rx="3" fill="#3e4a5a"/><rect x="540" y="${t + 188}" width="34" height="4" rx="2" fill="#7d8a99"/>
    <g transform="translate(704 ${t + 70})"><circle r="32" fill="#c99a6a"/><circle r="27" fill="#fffaf2"/>
      ${[...Array(12)].map((_, i) => `<path d="M0 -23 v${i % 3 ? 3 : 6}" stroke="#8a6a4f" stroke-width="${i % 3 ? 1.5 : 2.5}" transform="rotate(${i * 30})"/>`).join('')}
      <path d="M0 3 V-14" stroke="#3e4a5a" stroke-width="4" stroke-linecap="round" transform="rotate(${ang})"/><path d="M0 4 V-21" stroke="#3e4a5a" stroke-width="2.5" stroke-linecap="round" transform="rotate(${mang})"/>
      <circle r="3.5" fill="#ef5f7a"/></g>
    <g transform="translate(686 ${fl})"><ellipse cx="60" cy="0" rx="68" ry="6" fill="rgba(90,70,50,.12)"/>
      <rect x="0" y="-178" width="122" height="178" rx="5" fill="#b98a5c"/><rect x="7" y="-171" width="108" height="164" fill="#ecd6b8"/>
      ${[-118, -62].map(y => `<rect x="4" y="${y}" width="114" height="8" rx="2" fill="#a9754f"/><rect x="4" y="${y}" width="114" height="2.5" fill="#d9b48a"/>`).join('')}
      ${[0, 1, 2, 3, 4].map(i => `<rect x="${12 + i * 17}" y="${-166 + (i % 2) * 6}" width="14" height="${48 - (i % 2) * 6}" rx="2" fill="${['#f79aae', '#7fb6f0', '#ffd66b', '#8fd3b0', '#c9a0e6'][i]}"/><rect x="${14 + i * 17}" y="${-150 + (i % 2) * 6}" width="10" height="3" fill="#fff" opacity=".6"/>`).join('')}
      <g transform="translate(104 -120) rotate(-14)"><rect x="-6" y="-44" width="13" height="44" rx="2" fill="#f4a261"/></g>
      ${[0, 1, 2].map(i => `<rect x="${14 + i * 22}" y="-108" width="18" height="44" rx="2" fill="${['#5f9ee6', '#ef7d7d', '#49b07f'][i]}"/>`).join('')}
      <circle cx="96" cy="-76" r="10" fill="#9fd8cb"/><rect x="88" y="-76" width="16" height="12" rx="3" fill="#f4b99a"/>
      <rect x="12" y="-52" width="98" height="42" rx="4" fill="#d9b48a"/><rect x="20" y="-46" width="36" height="14" rx="2" fill="#fff"/><rect x="62" y="-46" width="40" height="14" rx="2" fill="#fff"/><path d="M28 -22 h76" stroke="#b98a5c" stroke-width="2"/><circle cx="60" cy="-26" r="3" fill="#8a6a4f"/></g>
    ${hmChair(600, fl, '#f7b9cc', '#e897b0')}
    ${hmDesk(470, 196, fl)}
    <rect x="534" y="${fl - 120}" width="72" height="44" rx="5" fill="#9aa8b6"/><rect x="538" y="${fl - 116}" width="64" height="36" rx="3" fill="#cfe7ff"/>
    <path d="M544 ${fl - 88} l12 -10 10 5 12 -12 12 8" fill="none" stroke="#f79aae" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M526 ${fl - 86} h88 l-6 -6 h-76 Z" fill="#7d8a99"/>
    <path d="M488 ${fl - 92} l28 -6 4 6 -28 6 Z" fill="#fff" stroke="#d9c7b0" stroke-width="1.5"/><path d="M492 ${fl - 98} l26 -6 4 6" fill="#fff6d6" stroke="#d9c7b0" stroke-width="1.5"/>
    ${hmMug(640, fl - 86)}
    ${hmPlant(90, fl, 1, true)}
    <g transform="translate(150 ${fl})"><rect x="0" y="-54" width="40" height="54" rx="6" fill="#b9cbd6"/><rect x="-4" y="-60" width="48" height="10" rx="5" fill="#9fb4c4"/><path d="M12 -44 v36 M20 -44 v36 M28 -44 v36" stroke="#9fb4c4" stroke-width="3" stroke-linecap="round"/><path d="M8 -62 l6 -10 6 8" fill="#fff" stroke="#d9c7b0" stroke-width="1.5"/></g>`);

  // ── 老闆辦公室（頂樓 5F）：落地窗＋窗簾、結餘金框、掛畫、主管桌、皮椅、沙發、立燈、地毯 ──
  t = T[HM_ROOM.boss]; fl = FL(HM_ROOM.boss);
  const bal = d.inc - d.exp;
  P.push(`${hmWin(110, t + 80, 200, 110, night, '#f3a9bf')}
    <ellipse cx="480" cy="${fl + 1}" rx="210" ry="13" fill="#d9a7b4"/><ellipse cx="480" cy="${fl - 1}" rx="200" ry="10" fill="#efc2cf"/><ellipse cx="480" cy="${fl - 1}" rx="170" ry="7" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="7 6" opacity=".7"/>
    <g transform="translate(480 ${t + 36})"><rect x="-104" y="0" width="208" height="110" rx="8" fill="url(#hbGold)"/><rect x="-96" y="8" width="192" height="94" rx="4" fill="#fffaf0"/>
      <path d="M-96 8 h20 l-20 20 Z M96 8 h-20 l20 20 Z M-96 102 h20 l-20 -20 Z M96 102 h-20 l20 -20 Z" fill="#f2c75c" opacity=".5"/>
      <text x="0" y="32" text-anchor="middle" font-size="19" font-weight="700" fill="#8a6a52">本月結餘</text>
      <text x="0" y="67" text-anchor="middle" font-size="34" font-weight="800" fill="${bal >= 0 ? '#dc2626' : '#16a34a'}">${bal >= 0 ? '+' : '−'}${hmShortMoney(Math.abs(bal))}</text>
      <text x="0" y="92" text-anchor="middle" font-size="18" font-weight="600" fill="#8a6a52">儲蓄率 ${d.inc ? Math.round(bal / d.inc * 100) + '%' : '—'}</text></g>
    <g transform="translate(700 ${t + 56})"><rect x="0" y="0" width="84" height="100" rx="6" fill="#fff" stroke="#c99a6a" stroke-width="6"/><rect x="10" y="10" width="64" height="80" fill="#e9f6f0"/>
      <path d="M10 90 l18 -34 14 18 12 -24 20 40 Z" fill="#8fd3b0"/><path d="M28 56 l6 10 -10 0 Z" fill="#fff"/><circle cx="58" cy="28" r="9" fill="#ffd66b"/></g>
    ${hmChair(480, fl, '#5b4a6b', '#4a3b58')}
    <ellipse cx="480" cy="${fl}" rx="136" ry="7" fill="rgba(90,70,50,.14)"/>
    <rect x="350" y="${fl - 92}" width="260" height="22" rx="7" fill="#8f5e4a"/><rect x="354" y="${fl - 92}" width="252" height="5" rx="2.5" fill="#fff" opacity=".25"/>
    <rect x="360" y="${fl - 70}" width="240" height="70" rx="4" fill="#a8705a"/><rect x="372" y="${fl - 62}" width="102" height="54" rx="4" fill="#9a6450"/><rect x="486" y="${fl - 62}" width="102" height="54" rx="4" fill="#9a6450"/>
    <path d="M384 ${fl - 52} h78 M498 ${fl - 52} h78" stroke="#c48a70" stroke-width="2"/><circle cx="462" cy="${fl - 35}" r="3.5" fill="#e0c07a"/><circle cx="498" cy="${fl - 35}" r="3.5" fill="#e0c07a"/>
    <rect x="444" y="${fl - 110}" width="72" height="18" rx="4" fill="url(#hbGold)"/><text x="480" y="${fl - 96}" text-anchor="middle" font-size="14" font-weight="800" fill="#6b4c1c">老 闆</text>
    ${hmMon(372, fl - 152, 74, 50, `<text x="409" y="${fl - 120}" text-anchor="middle" font-size="20" font-weight="800" fill="#7fd6d8">$</text>`, 6)}
    <g transform="translate(570 ${fl - 92})"><rect x="-12" y="-4" width="24" height="4" rx="2" fill="#5b4a3a"/><path d="M0 -4 L-6 -30 L10 -40" stroke="#5b4a3a" stroke-width="3" fill="none"/><path d="M2 -48 l22 6 -6 14 Z" fill="#f7d36b"/>${night ? '<ellipse cx="18" cy="-20" rx="20" ry="14" fill="#fff3c0" opacity=".35"/>' : ''}</g>
    <path d="M520 ${fl - 96} l20 -4" stroke="#3e4a5a" stroke-width="3" stroke-linecap="round"/>
    <g transform="translate(640 ${fl})"><rect x="-4" y="-150" width="8" height="150" fill="#8a6a4f"/><ellipse cx="0" cy="-2" rx="20" ry="5" fill="#8a6a4f"/>
      <path d="M-28 -150 h56 l-12 -40 h-32 Z" fill="#ffe8b0" stroke="#e8c98a" stroke-width="2"/>${night ? '<ellipse cx="0" cy="-120" rx="70" ry="50" fill="#fff3c0" opacity=".3"/>' : ''}</g>
    <g transform="translate(740 ${fl})"><ellipse cx="0" cy="0" rx="84" ry="6" fill="rgba(90,70,50,.14)"/>
      <rect x="-76" y="-108" width="152" height="66" rx="26" fill="#f3a9bf"/><rect x="-84" y="-56" width="168" height="48" rx="18" fill="#f7b9cc"/>
      <rect x="-90" y="-80" width="24" height="70" rx="11" fill="#e897b0"/><rect x="66" y="-80" width="24" height="70" rx="11" fill="#e897b0"/>
      <rect x="-62" y="-98" width="56" height="44" rx="16" fill="#fde0e9"/><rect x="6" y="-98" width="56" height="44" rx="16" fill="#fde0e9"/>
      <rect x="-30" y="-88" width="30" height="26" rx="8" fill="#fff6c8" transform="rotate(-10 -15 -75)"/>
      <rect x="-76" y="-8" width="12" height="8" rx="3" fill="#c97d93"/><rect x="64" y="-8" width="12" height="8" rx="3" fill="#c97d93"/></g>
    ${hmPlant(66, fl, 1.05)}`);

  // ── 記帳室（2F）：窗戶、記錄燈箱、記帳櫃台（帳本、收據機、服務鈴）、檔案櫃、公告欄、紙箱 ──
  t = T[HM_ROOM.book]; fl = FL(HM_ROOM.book);
  const notes = d.recs.filter(r => r.item).slice().sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : (b.row || 0) - (a.row || 0))).slice(0, 3);
  const noteSvg = notes.map((r, i) => `<g transform="translate(${642 + i * 60} ${t + 80}) rotate(${[-4, 3, -2][i]})"><rect width="56" height="62" rx="3" fill="${['#fff3a8', '#ffd1dc', '#c8f0ff'][i]}"/><rect width="56" height="8" fill="#000" opacity=".05"/>
    <circle cx="28" cy="4" r="4.5" fill="#ef5f7a"/><text x="28" y="29" text-anchor="middle" font-size="14" font-weight="700" fill="#4a3b30">${hmT(r.item, 3)}</text>
    <text x="28" y="51" text-anchor="middle" font-size="14" font-weight="800" fill="${r.income ? '#dc2626' : r.expense ? '#16a34a' : '#6b7280'}">${r.income ? '+' + hmShortMoney(r.income) : r.expense ? '−' + hmShortMoney(r.expense) : '⇄'}</text></g>`).join('')
    || `<text x="728" y="${t + 124}" text-anchor="middle" font-size="19" fill="#8a6a4f">還沒有紀錄</text>`;
  const pc = Math.min(d.todayCount, 6);
  P.push(`${hmWin(64, t + 78, 120, 96, night)}
    <g transform="translate(340 ${t + 64})"><rect x="-88" y="0" width="176" height="86" rx="12" fill="#fff" stroke="#7fd6d8" stroke-width="5"/>${night ? '<rect x="-88" y="0" width="176" height="86" rx="12" fill="#bff3f3" opacity=".25"/>' : ''}
      <text x="0" y="30" text-anchor="middle" font-size="19" font-weight="700" fill="#7b8094">本月紀錄</text><text x="0" y="72" text-anchor="middle" font-size="36" font-weight="800" fill="#0a9396">${d.count} 筆</text>
      <path d="M-50 -24 L-40 0 M50 -24 L40 0" stroke="#9aa8b6" stroke-width="2"/></g>
    <g><ellipse cx="330" cy="${fl}" rx="132" ry="6" fill="rgba(90,70,50,.12)"/>
      <rect x="200" y="${fl - 98}" width="260" height="16" rx="6" fill="#f4d9b6"/><rect x="204" y="${fl - 98}" width="252" height="4" rx="2" fill="#fff" opacity=".5"/>
      <rect x="208" y="${fl - 82}" width="244" height="82" rx="6" fill="#7fd6d8"/><rect x="208" y="${fl - 82}" width="244" height="14" fill="#5fc0c4"/>
      <path d="M224 ${fl - 60} v52 M436 ${fl - 60} v52" stroke="#9fe2e4" stroke-width="3"/>
      <circle cx="330" cy="${fl - 34}" r="20" fill="#fff"/><text x="330" y="${fl - 27}" text-anchor="middle" font-size="20">📒</text></g>
    <g transform="translate(250 ${fl - 98})"><path d="M-30 0 Q0 -12 30 0 V-24 Q0 -36 -30 -24 Z" fill="#fff" stroke="#9aa3c4" stroke-width="2"/><path d="M0 -6 V-30" stroke="#9aa3c4" stroke-width="2"/>
      <path d="M-24 -20 h18 M-24 -13 h16 M6 -20 h18 M6 -13 h14" stroke="#c9cfe0" stroke-width="2"/><path d="M14 -2 l18 -26" stroke="#ef7d9a" stroke-width="3" stroke-linecap="round"/></g>
    <g transform="translate(400 ${fl - 98})"><rect x="-24" y="-26" width="48" height="26" rx="6" fill="#5b6475"/><rect x="-18" y="-22" width="36" height="8" rx="2" fill="#2f3845"/>
      <path d="M-14 -26 v-${10 + pc * 6} h28 v${10 + pc * 6}" fill="#fff" stroke="#d9cfc5" stroke-width="1.5"/>
      ${[...Array(pc)].map((_, i) => `<path d="M-9 ${-32 - i * 6} h18" stroke="#c9cfe0" stroke-width="2"/>`).join('')}</g>
    <g transform="translate(442 ${fl - 98})"><path d="M-9 0 a9 9 0 0 1 18 0 Z" fill="#ffd66b"/><rect x="-11" y="-1" width="22" height="3" rx="1.5" fill="#c99a6a"/><circle cy="-10" r="2" fill="#e0a82e"/></g>
    <g transform="translate(560 ${fl})"><ellipse cx="0" cy="0" rx="44" ry="5" fill="rgba(90,70,50,.12)"/>
      <rect x="-38" y="-170" width="76" height="170" rx="6" fill="#9aa8b6"/>
      ${[0, 1, 2].map(i => `<rect x="-32" y="${-162 + i * 54}" width="64" height="48" rx="4" fill="#c5d0db"/><rect x="-14" y="${-150 + i * 54}" width="28" height="7" rx="3.5" fill="#7d8a99"/><rect x="-18" y="${-138 + i * 54}" width="36" height="12" rx="2" fill="#fff"/><text x="0" y="${-128 + i * 54}" text-anchor="middle" font-size="10" font-weight="700" fill="#5b6475">${['發票', '收據', '帳單'][i]}</text>`).join('')}
      <g transform="translate(0 -170)"><rect x="-22" y="-26" width="44" height="26" rx="3" fill="#e3b98a"/><path d="M-22 -18 h44" stroke="#c99a6a" stroke-width="2"/><rect x="-6" y="-26" width="12" height="26" fill="#f3dfc0" opacity=".8"/></g></g>
    <g><rect x="636" y="${t + 60}" width="186" height="124" rx="8" fill="#c99a6a"/><rect x="643" y="${t + 67}" width="172" height="110" rx="5" fill="#e8c9a0"/>
      ${[...Array(10)].map((_, i) => `<circle cx="${654 + (i * 37) % 150}" cy="${t + 80 + (i * 23) % 90}" r="1.4" fill="#c4a27a"/>`).join('')}
      <rect x="676" y="${t + 46}" width="104" height="26" rx="8" fill="#ef7d9a"/><text x="728" y="${t + 65}" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">最新紀錄</text>${noteSvg}</g>
    <g transform="translate(730 ${fl})"><ellipse cx="0" cy="0" rx="60" ry="5" fill="rgba(90,70,50,.12)"/>
      <rect x="-52" y="-46" width="60" height="46" rx="3" fill="#e3b98a" stroke="#c99a6a" stroke-width="2"/><path d="M-52 -36 h60" stroke="#c99a6a" stroke-width="2"/><rect x="-26" y="-46" width="10" height="46" fill="#f3dfc0" opacity=".8"/>
      <rect x="12" y="-30" width="44" height="30" rx="3" fill="#ecd6b8" stroke="#c99a6a" stroke-width="2"/><rect x="-40" y="-76" width="40" height="30" rx="3" fill="#ecd6b8" stroke="#c99a6a" stroke-width="2"/>
      <path d="M20 -36 l6 -10 6 8 M-30 -82 l6 -8 6 8" fill="#fff" stroke="#d9c7b0" stroke-width="1.5"/></g>
    ${hmPlant(160, fl, 0.85, true)}`);

  // ── 大廳・休息區（1F）：玻璃大門、樓層指南、電視、沙發＋茶几、咖啡吧（咖啡機、點心、飲水機）──
  t = T[HM_ROOM.lobby]; fl = FL(HM_ROOM.lobby);
  const guide = [6, 5, 4, 3, 2, 1].map((f, i) => `<text x="222" y="${t + 96 + i * 19}" font-size="14" font-weight="700" fill="#5b6475">${hmT(HM_FLOOR_NAME[f], 9)}</text>`).join('');
  P.push(`<ellipse cx="470" cy="${fl + 1}" rx="150" ry="11" fill="#e6cfae"/><ellipse cx="470" cy="${fl - 1}" rx="140" ry="8" fill="#f3dcc0"/>
    <g><rect x="56" y="${fl - 190}" width="124" height="190" rx="8" fill="#c99a6a"/>
      <rect x="64" y="${fl - 182}" width="52" height="182" rx="4" fill="url(#hbGlass)"/><rect x="120" y="${fl - 182}" width="52" height="182" rx="4" fill="url(#hbGlass)"/>
      <path d="M74 ${fl - 120} l26 -50 M80 ${fl - 90} l14 -26 M130 ${fl - 120} l26 -50" stroke="#fff" stroke-width="5" opacity=".6"/>
      <rect x="104" y="${fl - 120}" width="6" height="34" rx="3" fill="#9aa8b6"/><rect x="126" y="${fl - 120}" width="6" height="34" rx="3" fill="#9aa8b6"/>
      <rect x="62" y="${fl - 222}" width="112" height="28" rx="14" fill="#0a9396"/><text x="118" y="${fl - 202}" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">ENTRANCE</text>
      <rect x="52" y="${fl - 3}" width="132" height="6" rx="3" fill="#e0b0a0"/></g>
    <g><rect x="208" y="${t + 56}" width="140" height="146" rx="8" fill="#8a6a4f"/><rect x="214" y="${t + 62}" width="128" height="134" rx="5" fill="#fffaf2"/>
      <rect x="214" y="${t + 62}" width="128" height="24" rx="5" fill="#0a9396"/><text x="278" y="${t + 80}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">樓層指南</text>
      ${guide}</g>
    <g transform="translate(470 ${t + 56})"><rect x="-74" y="0" width="148" height="88" rx="6" fill="#2f3845"/><rect x="-68" y="6" width="136" height="72" rx="3" fill="${night ? '#22345a' : '#cfe7ff'}"/>
      <text x="0" y="32" text-anchor="middle" font-size="14" font-weight="800" fill="${night ? '#ffd66b' : '#0a5c5f'}">📺 帳本新聞</text>
      <text x="0" y="58" text-anchor="middle" font-size="15" font-weight="700" fill="${d.inc - d.exp >= 0 ? '#dc2626' : '#16a34a'}">本月結餘 ${d.inc - d.exp >= 0 ? '+' : '−'}${hmShortMoney(Math.abs(d.inc - d.exp))}</text>
      <rect x="-20" y="88" width="40" height="5" rx="2" fill="#5b6475"/></g>
    <g transform="translate(470 ${fl})"><ellipse cx="0" cy="0" rx="100" ry="6" fill="rgba(90,70,50,.14)"/>
      <rect x="-92" y="-108" width="184" height="62" rx="24" fill="#7fc7b8"/><rect x="-100" y="-58" width="200" height="46" rx="18" fill="#93d3c5"/>
      <rect x="-108" y="-80" width="24" height="68" rx="11" fill="#6ab5a5"/><rect x="84" y="-80" width="24" height="68" rx="11" fill="#6ab5a5"/>
      <rect x="-76" y="-98" width="64" height="42" rx="16" fill="#c4ece2"/><rect x="12" y="-98" width="64" height="42" rx="16" fill="#c4ece2"/>
      <rect x="-40" y="-90" width="28" height="24" rx="7" fill="#ffd1dc" transform="rotate(-10 -26 -78)"/><rect x="40" y="-90" width="26" height="22" rx="7" fill="#fff3a8" transform="rotate(8 53 -79)"/>
      <rect x="-90" y="-12" width="12" height="12" rx="3" fill="#5a9c8d"/><rect x="78" y="-12" width="12" height="12" rx="3" fill="#5a9c8d"/></g>
    <g transform="translate(652 ${fl})"><ellipse cx="0" cy="0" rx="100" ry="6" fill="rgba(90,70,50,.12)"/>
      <rect x="-60" y="-86" width="170" height="16" rx="6" fill="#f4d9b6"/><rect x="-56" y="-86" width="162" height="4" rx="2" fill="#fff" opacity=".5"/>
      <rect x="-54" y="-70" width="158" height="70" rx="5" fill="#a9754f"/><rect x="-46" y="-62" width="68" height="54" rx="4" fill="#c99a6a"/><rect x="30" y="-62" width="66" height="54" rx="4" fill="#c99a6a"/>
      <circle cx="16" cy="-35" r="3" fill="#ffd66b"/><circle cx="36" cy="-35" r="3" fill="#ffd66b"/>
      <g transform="translate(-20 -86)"><rect x="-30" y="-92" width="60" height="92" rx="12" fill="#e9eff5" stroke="#c5d2de" stroke-width="2"/>
        <rect x="-30" y="-92" width="60" height="22" rx="11" fill="#5b6475"/><rect x="-30" y="-80" width="60" height="10" fill="#5b6475"/>
        <circle cx="10" cy="-81" r="4" fill="#ef7d7d"/><circle cx="21" cy="-81" r="4" fill="#8fd3b0"/><rect x="-23" y="-87" width="20" height="11" rx="3" fill="#2f3845"/>
        <rect x="-14" y="-62" width="28" height="9" rx="4" fill="#3e4a5a"/><rect x="-4" y="-53" width="8" height="6" rx="2" fill="#2f3845"/>
        <rect class="hb-drip" x="-1.5" y="-47" width="3" height="14" rx="1.5" fill="#8a5a3b"/>
        <path d="M-11 -30 h22 l-3 20 h-16 Z" fill="#fff" stroke="#d9c7b0" stroke-width="2"/><rect x="-22" y="-10" width="44" height="8" rx="3" fill="#9aa8b6"/>
        <path class="hb-steam" d="M-5 -34 q-4 -7 0 -13 M5 -34 q4 -7 0 -13" fill="none" stroke="#a9bfd8" stroke-width="2.6" stroke-linecap="round"/></g>
      ${[0, 1, 2].map(i => `<path d="M${26 + i * 14} -100 h10 l-1 14 h-8 Z" fill="${['#fff', '#fde0e9', '#e9f6f0'][i]}" stroke="#d9c7b0" stroke-width="1.5"/>`).join('')}
      <g transform="translate(86 -86)"><rect x="-14" y="-30" width="28" height="30" rx="6" fill="#dff2fd" stroke="#a9cbe2" stroke-width="2"/><rect x="-10" y="-38" width="20" height="10" rx="4" fill="#f4b99a"/>
        <circle cx="-5" cy="-12" r="4" fill="#c99a6a"/><circle cx="5" cy="-8" r="4" fill="#e3b98a"/><circle cx="0" cy="-20" r="4" fill="#c99a6a"/></g></g>
    <g transform="translate(800 ${fl})"><ellipse cx="0" cy="0" rx="20" ry="4" fill="rgba(90,70,50,.12)"/><rect x="-15" y="-88" width="30" height="88" rx="6" fill="#f3f5f8" stroke="#c5d2de" stroke-width="2"/>
      <rect x="-11" y="-134" width="22" height="46" rx="8" fill="#9fd0f0" opacity=".85"/><rect x="-6" y="-126" width="5" height="30" rx="2" fill="#fff" opacity=".6"/>
      <rect x="-8" y="-70" width="6" height="8" rx="2" fill="#5f9ee6"/><rect x="2" y="-70" width="6" height="8" rx="2" fill="#ef7d7d"/></g>
    <g><rect x="600" y="${t + 70}" width="160" height="70" rx="8" fill="#3e4a5a" stroke="#c99a6a" stroke-width="5"/>
      <text x="680" y="${t + 98}" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">☕ 咖啡吧</text>
      <text x="680" y="${t + 124}" text-anchor="middle" font-size="14" fill="#ffd66b">${hmNight() ? '今晚：熱可可 🍫' : now.getHours() < 11 ? '早安拿鐵 🥛' : '午後美式 ☕'}</text></g>
    ${hmPlant(205, fl, 0.8, true)}`);

  // ── 電梯井：每層一扇門、樓層燈、呼叫鈕 ──
  P.push(`<rect x="832" y="${TOP}" width="148" height="${BOT - TOP}" fill="#cdbba6"/><path d="M848 ${TOP} v${BOT - TOP} M964 ${TOP} v${BOT - TOP}" stroke="#b39f88" stroke-width="5"/>`);
  [6, 5, 4, 3, 2, 1].forEach(f => {
    const y = FL(f);
    P.push(`<rect x="840" y="${y - 178}" width="132" height="178" rx="8" fill="#9aa8b6"/><rect x="840" y="${y - 178}" width="132" height="6" rx="3" fill="#c5d0db"/>
      <rect x="846" y="${y - 170}" width="60" height="170" fill="#c5d0db"/><rect x="906" y="${y - 170}" width="60" height="170" fill="#c5d0db"/>
      <path d="M906 ${y - 170} v170" stroke="#9aa8b6" stroke-width="2"/><path d="M856 ${y - 160} v150 M956 ${y - 160} v150" stroke="#dfe5eb" stroke-width="4" opacity=".8"/>
      <rect x="868" y="${y - 218}" width="76" height="36" rx="9" fill="#2f3845"/><text x="906" y="${y - 191}" font-size="26" font-weight="800" text-anchor="middle" fill="#9fb0c2">${f}F</text>
      <rect x="818" y="${y - 104}" width="14" height="32" rx="4" fill="#dfe5eb" stroke="#9aa8b6" stroke-width="1.5"/><circle cx="825" cy="${y - 94}" r="3.5" fill="#ffd66b"/><circle cx="825" cy="${y - 81}" r="3.5" fill="#c5d0db"/>`);
  });

  // ── 戶外：人行道、馬路、草地、樹、路燈、長椅、信箱、花 ──
  const g0 = BOT, H = HM_H;
  const tree = (x, k) => `<g class="hb-tree" style="transform-origin:${x}px ${H}px"><rect x="${x - 9 * k}" y="${H - 110 * k}" width="${18 * k}" height="${110 * k}" rx="6" fill="#a9754f"/>
    <circle cx="${x}" cy="${H - 130 * k}" r="${52 * k}" fill="${night ? '#3f6b4a' : '#7cc49a'}"/><circle cx="${x - 36 * k}" cy="${H - 100 * k}" r="${36 * k}" fill="${night ? '#467855' : '#8fd3b0'}"/>
    <circle cx="${x + 38 * k}" cy="${H - 104 * k}" r="${34 * k}" fill="${night ? '#467855' : '#8fd3b0'}"/><circle cx="${x - 14 * k}" cy="${H - 150 * k}" r="${10 * k}" fill="#fff" opacity=".25"/></g>`;
  P.push(`<rect x="0" y="${g0}" width="1000" height="34" fill="#d9c7b0"/>${[...Array(10)].map((_, i) => `<path d="M${i * 100} ${g0} v34" stroke="#c9b49b" stroke-width="2"/>`).join('')}
    <rect x="52" y="${g0}" width="132" height="10" fill="#efe3d3"/>
    <rect x="0" y="${g0 + 34}" width="1000" height="7" fill="#9aa3ad"/>
    <rect x="0" y="${g0 + 41}" width="1000" height="66" fill="${night ? '#3e434d' : '#7b828c'}"/>
    <path d="M0 ${g0 + 74} H1000" stroke="#ffd66b" stroke-width="5" stroke-dasharray="40 30"/>
    <rect x="0" y="${g0 + 107}" width="1000" height="7" fill="#9aa3ad"/>
    <rect x="0" y="${g0 + 114}" width="1000" height="${H - g0 - 114}" fill="${night ? '#5f8a5c' : '#a8d8a0'}"/>
    <g class="hb-car"><g transform="translate(0 ${g0 + 96})"><rect x="-70" y="-30" width="96" height="24" rx="10" fill="#f79aae"/><path d="M-56 -30 l12 -16 h42 l12 16 Z" fill="#f79aae"/><path d="M-48 -32 l8 -11 h14 v11 Z M-22 -32 v-11 h12 l8 11 Z" fill="#dff2fd"/>
      <circle cx="-48" cy="-6" r="9" fill="#3e4a5a"/><circle cx="6" cy="-6" r="9" fill="#3e4a5a"/><circle cx="-48" cy="-6" r="3.5" fill="#c5d0db"/><circle cx="6" cy="-6" r="3.5" fill="#c5d0db"/><rect x="22" y="-26" width="6" height="6" rx="2" fill="#ffd66b"/></g></g>
    ${tree(70, 0.55)}${tree(940, 0.6)}
    <g><rect x="420" y="${g0 + 12}" width="120" height="8" rx="4" fill="#c99a6a"/><rect x="420" y="${g0 - 6}" width="120" height="8" rx="4" fill="#c99a6a"/><rect x="430" y="${g0 + 20}" width="8" height="14" fill="#8a6a4f"/><rect x="522" y="${g0 + 20}" width="8" height="14" fill="#8a6a4f"/></g>
    <g transform="translate(300 ${H - 4}) scale(.6)"><rect x="-4" y="-40" width="8" height="40" fill="#5b6475"/><rect x="-24" y="-80" width="48" height="40" rx="12" fill="#ef7d9a"/><rect x="-14" y="-66" width="28" height="5" rx="2" fill="#a8455d"/><text x="0" y="-48" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">帳單</text><path d="M20 -78 v-14 h10 v8 h-10" fill="#ffd66b"/></g>
    ${[200, 330, 600, 640, 820].map((x, i) => `<path d="M${x} ${H - 8} v-16" stroke="#5f9e7a" stroke-width="3"/><circle cx="${x}" cy="${H - 28}" r="7" fill="${['#f7a8c0', '#ffd66b', '#c9a0e6', '#ef7d7d', '#9fd0f0'][i]}"/><circle cx="${x}" cy="${H - 28}" r="2.6" fill="#fff6c9"/>`).join('')}`);
  // 夜晚：整棟樓的燈光
  if (night) P.push(`<rect x="0" y="0" width="${HM_W}" height="${HM_H}" fill="#1b2150" opacity=".08"/>`);
  $('hmScene').querySelector('.hm-room').innerHTML = `<svg viewBox="0 0 ${HM_W} ${HM_H}" preserveAspectRatio="none" aria-hidden="true">${P.join('')}</svg>`;
}
function hmBuildScene() {
  const box = $('hmScene');
  box.innerHTML = `<div class="hm-room"></div><div class="hm-lift"><div class="hm-lift-doors"><i></i><i></i></div><span id="hmLiftInd" class="hm-lift-ind">1F</span></div>`;
  hmLift.el = box.querySelector('.hm-lift');
  hmLift.doorEl = box.querySelector('.hm-lift-doors');
  hmLiftPos();
  hmActors = {};
  HM_ACTORS.forEach(c => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hm-actor';
    el.innerHTML = `<span class="hm-fig">${hmPerson(c.look)}</span><span class="hm-tag">${esc(c.name)}</span><span class="hm-bub"></span>`;
    const s = hmSpot(c.seat);
    const a = { ...c, el, figEl: el.querySelector('.hm-fig'), bubEl: el.querySelector('.hm-bub'), pos: [s.x, hmFeet(s.f)], floor: s.f, busy: false };
    el.addEventListener('click', () => { if (hmData_) { hmSay(c.id, `${c.name}（${c.role}）：${hmLine(c.id, hmData_)}`, 3600); el.classList.add('happy'); setTimeout(() => el.classList.remove('happy'), 900); } });
    box.appendChild(el);
    hmActors[c.id] = a;
    hmPlace(a);
  });
  hmBuilt = true;
}

// ── 記帳時的反應：記一筆收入／支出／轉帳，大樓裡的人會有對應的動作 ──────────
let hmPending = [];
// 從 app.js 儲存成功後呼叫；不在首頁時先排隊，回到首頁再播
function hmOnRecord(rec, edited) {
  hmPending.push({ rec, edited });
  if (activeTab === 'home' && hmBuilt) setTimeout(hmPlayPending, 400);
}
function hmPlayPending() {
  if (!hmPending.length || !hmBuilt || activeTab !== 'home') return;
  const list = hmPending.splice(0);
  hmData_ = hmData();
  hmDrawBuilding(hmData_);
  // 一次存了好幾筆時，只演最後一筆，其他的用一句話帶過
  const last = list[list.length - 1];
  hmReact(last.rec, last.edited, list.length - 1).catch(() => {});
}
// 數字往上飄的小動畫
function hmPop(text, x, y, cls = '') {
  const box = $('hmScene');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'hm-pop ' + cls;
  el.textContent = text;
  el.style.left = (x / HM_W * 100) + '%';
  el.style.top = (y / HM_H * 100) + '%';
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function hmJoy(id, ms = 1400) {
  const a = hmActors[id];
  if (!a) return;
  a.el.classList.add('happy');
  setTimeout(() => a.el.classList.remove('happy'), ms);
}
// 把某一層捲到畫面中間（已經看得到就不捲）
function hmShowFloor(f) {
  const box = $('hmScene');
  if (!box) return;
  const rc = box.getBoundingClientRect();
  const y = rc.top + (HM_FT[f] + HM_FH / 2) / HM_H * rc.height;
  const fh = HM_FH / HM_H * rc.height;
  if (y - fh / 2 >= 60 && y + fh / 2 <= window.innerHeight) return;
  window.scrollTo({ top: window.scrollY + y - window.innerHeight / 2, behavior: 'smooth' });
}
async function hmReact(r, edited, more) {
  const d = hmData_;
  const amt = Number(r.expense || r.income || r.transfer) || 0;
  const item = String(r.item || '').slice(0, 10);
  hmNext = performance.now() + 9000;          // 先暫停閒晃，讓大家專心演這一筆
  hmShowFloor(edited ? hmActors.book.floor : r.type === '轉帳' ? HM_ROOM.xfer : HM_ROOM.book);
  const book = hmActors.book, fl1 = hmFL(HM_ROOM.book);
  if (edited) {
    hmSay('book', `「${item}」改好了 ✏️`, 3000);
    hmJoy('book');
    return;
  }
  if (more > 0) { hmSay('book', `一口氣記了 ${more + 1} 筆，辛苦了 📚`, 2600); await hmWait(2200); }
  if (r.type === '轉帳') {
    // 5F：小轉接單、蓋章、氣送管送出
    const x = hmActors.xfer;
    hmPop(`🔁 ${hmShortMoney(amt)}`, 196, hmFL(HM_ROOM.xfer) - 90, 'xfer');
    hmSay('xfer', `收到轉帳單：${r.account} → ${r.toAccount} ${hmShortMoney(amt)} 🔁`, 3400);
    hmJoy('xfer');
    await hmWait(3000);
    if (/股息/.test(r.item || '')) { hmSay('stock', `股息入帳 ${hmShortMoney(amt)}！💰`, 3000); hmJoy('stock', 2000); hmPop('💰', hmActors.stock.pos[0], hmActors.stock.pos[1] - 110); }
    else if (isStockAcc(r.toAccount || '')) { hmSay('stock', '資金到位，可以準備買股了 📈', 3000); hmJoy('stock'); }
    else if (isStockAcc(r.account || '')) { hmSay('stock', '從股票帳戶轉出去了，記一下 📝', 3000); }
    else hmSay(x.id, pk(['氣送管咻～送到了 🚀', '轉好了，記得對一下餘額 🧾', '錢只是換個口袋 👛']), 2600);
    return;
  }
  if (r.type === '收入') {
    hmPop(`+${hmShortMoney(amt)}`, 470, fl1 - 170, 'inc');
    hmSay('book', `進帳啦！${item} +${hmShortMoney(amt)} 💰`, 3200);
    hmJoy('book');
    await hmWait(1600);
    const payday = /薪/.test((r.category || '') + item);
    if (payday) {
      Object.keys(hmActors).forEach(id => hmJoy(id, 2400));
      hmSay('me', '發薪日～大家辛苦了！🎉', 3200);
      await hmWait(1400);
      hmSay('chart', '收入更新！儲蓄率重新計算中 📊', 2800);
    } else {
      hmSay('me', pk(['太棒了，有進帳！🎉', '收入 +1，開心 😆', '錢錢來了 💰']), 2800);
      hmJoy('me');
    }
    return;
  }
  // 支出
  hmPop(`−${hmShortMoney(amt)}`, 470, fl1 - 170, 'exp');
  hmSay('book', `記下一筆：${item} −${hmShortMoney(amt)} 🧾`, 3200);
  hmJoy('book', 900);
  await hmWait(2400);
  const cat = r.category ? catText(r.category) : '';
  const share = d.exp ? Math.round((d.cats.find(([n]) => n === r.category) || [0, 0])[1] / d.exp * 100) : 0;
  hmSay('chart', cat ? `${cat} 現在占支出 ${share}% 📊` : '支出圓餅更新好了 📊', 2800);
  // 大筆支出：小記搭電梯上 2F 跟老闆報告
  const exps = d.recs.filter(x => x.type === '支出' && Number(x.expense) > 0);
  const avg = exps.length ? d.exp / exps.length : 0;
  if (amt >= Math.max(3000, avg * 3) && !book.busy && !hmActors.me.busy && hmActors.me.floor === HM_ROOM.boss) {
    book.busy = true; hmActors.me.busy = true;
    try {
      hmShowFloor(HM_ROOM.boss);
      await hmGo('book', 'meetBook');
      book.figEl.classList.remove('flip');
      hmActors.me.figEl.classList.add('flip');
      hmSay('book', `老闆！剛剛有一筆大支出「${item}」${hmShortMoney(amt)} 😱`, 3000);
      await hmWait(2600);
      hmSay('me', pk(['…這筆是必要的啦 😅', '嗯，下個月省一點 🫣', '收到，我心裡有數 😌']), 2800);
      await hmWait(2400);
    } finally { hmActors.me.busy = false; hmActors.me.figEl.classList.remove('flip'); }
    await hmGo('book', 'book');
    book.busy = false;
  }
}

// ── 下方資訊：每一區都能點開看細項 ──────────────────────────────
const hmOpen = { exp: null, inc: null, xfer: null, month: null, card: null };
function hmToggle(kind, key) {
  hmOpen[kind] = hmOpen[kind] === key ? null : key;
  renderHome();
}
const hmByDate = list => list.slice().sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : (b.row || 0) - (a.row || 0)));
function hmRecList(list, empty = '沒有紀錄', keep = false) {
  return list.length ? `<div class="hm-detail">${(keep ? list : hmByDate(list)).map(r => rowHtml(r, true)).join('')}</div>` : `<div class="hm-detail"><div class="empty">${empty}</div></div>`;
}
function hmShareRow(kind, key, v, total, color, label, list) {
  const open = hmOpen[kind] === key;
  return `<div class="hm-share hm-click${open ? ' open' : ''}" role="button" tabindex="0" data-hm="${kind}" data-key="${esc(key)}">
      <i style="background:${color}"></i><span>${esc(label)} <em class="hm-n">${list.length} 筆</em></span>
      <em class="bar"><b style="width:${total ? (v / total * 100).toFixed(1) : 0}%;background:${color}"></b></em><strong>${total ? Math.round(v / total * 100) : 0}%</strong><small>${money(v)}</small><u class="hm-chev">›</u></div>
    ${open ? hmRecList(list) : ''}`;
}
function hmCardDetail(d, expRecs, incRecs) {
  const k = hmOpen.card;
  if (!k) return '';
  if (k === 'inc') return `<p class="hm-note">💚 收入 ${incRecs.length} 筆，共 ${money(d.inc)}</p>${hmRecList(incRecs, '這個月還沒有收入')}`;
  if (k === 'exp') {
    const big = expRecs.slice().sort((a, b) => b.expense - a.expense).slice(0, 10);
    const days = d.isNow ? Number(todayIso().slice(8)) : new Set(expRecs.map(r => r.iso)).size || 1;
    return `<p class="hm-note">🧾 支出 ${expRecs.length} 筆，平均每筆 ${money(expRecs.length ? d.exp / expRecs.length : 0)}，平均每天 ${money(d.exp / Math.max(1, days))}</p>
      <p class="hm-note">金額最大的 ${big.length} 筆：</p>${hmRecList(big, '這個月還沒有支出', true)}`;
  }
  const sorted = months.slice().sort((a, b) => sheetOrder(a) - sheetOrder(b));
  const end = sorted.indexOf(current);
  const six = sorted.slice(Math.max(0, end - 5), end + 1).filter(m => Array.isArray(monthData[m]));
  const stat = m => { const rs = monthData[m].filter(r => r.type !== '轉帳'); const i = sum(rs, 'income'), e = sum(rs, 'expense'); return { i, e, b: i - e, rate: i ? Math.round((i - e) / i * 100) : null }; };
  if (k === 'bal') return `<div class="hm-calc">
      <div><span>💚 收入</span><b class="amt-inc">${money(d.inc)}</b></div>
      <div><span>🧾 支出</span><b class="amt-exp">− ${money(d.exp)}</b></div>
      <div class="sum"><span>🌟 結餘</span><b class="${d.inc - d.exp >= 0 ? 'amt-inc' : 'amt-exp'}">${money(d.inc - d.exp)}</b></div>
      ${d.xfers.length ? `<div class="muted"><span>🔁 轉帳（不計入）</span><b>${money(d.xferTotal)}</b></div>` : ''}</div>`;
  return `<div class="hm-calc">${six.slice().reverse().map(m => { const st = stat(m); return `<div${m === current ? ' class="sum"' : ''}><span>${esc(m.replace(/^\d{4}\//, ''))}</span><b class="${st.rate == null ? '' : st.rate >= 0 ? 'amt-inc' : 'amt-exp'}">${st.rate == null ? '—' : st.rate + '%'}</b></div>`; }).join('')}</div>
    <p class="hm-note">儲蓄率 =（收入 − 支出）÷ 收入</p>`;
}
function hmMonthRow(m) {
  const rs = monthData[m].filter(r => r.type !== '轉帳');
  const i = sum(rs, 'income'), e = sum(rs, 'expense');
  const open = hmOpen.month === m;
  let detail = '';
  if (open) {
    const cats = groupSum(rs.filter(r => Number(r.expense) > 0), r => r.category || '未分類', 'expense').slice(0, 5);
    detail = `<div class="hm-detail hm-mdetail">
      ${cats.map(([n, v]) => `<div class="hm-mcat"><span>${esc(catText(n))}</span><em class="bar"><b style="width:${e ? (v / e * 100).toFixed(1) : 0}%"></b></em><small>${money(v)}</small></div>`).join('') || '<div class="empty">沒有支出</div>'}
      <p class="hm-note">共 ${monthData[m].length} 筆${i ? `，儲蓄率 ${Math.round((i - e) / i * 100)}%` : ''}</p>
      ${m !== current ? `<button type="button" class="btn hm-go" data-hm-go="${esc(m)}">切換到 ${esc(m.replace(/^\d{4}\//, ''))} 👉</button>` : ''}</div>`;
  }
  return `<div class="hm-month hm-click${open ? ' open' : ''}${m === current ? ' cur' : ''}" role="button" tabindex="0" data-hm="month" data-key="${esc(m)}">
      <span>${esc(m.replace(/^\d{4}\//, ''))}</span><b class="amt-inc">+${hmShortMoney(i)}</b><b class="amt-exp">−${hmShortMoney(e)}</b><b class="${i - e >= 0 ? 'amt-inc' : 'amt-exp'}">${i - e >= 0 ? '+' : '−'}${hmShortMoney(Math.abs(i - e))}</b><u class="hm-chev">›</u></div>${detail}`;
}
// 點擊：展開／收合、開紀錄、切換月份
document.addEventListener('DOMContentLoaded', () => {
  const box = $('tab-home');
  if (!box) return;
  const act = e => {
    const rec = e.target.closest('.rec');
    if (rec && box.contains(rec)) {
      const r = pool().find(x => x.sheet === rec.dataset.sheet && String(x.row) === rec.dataset.row);
      if (r) openRecordModal(r);
      return;
    }
    const go = e.target.closest('[data-hm-go]');
    if (go) { hmOpen.month = null; switchMonth(go.dataset.hmGo); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const card = e.target.closest('.hm-card');
    if (card) return hmToggle('card', card.dataset.card);
    const row = e.target.closest('[data-hm]');
    if (row) hmToggle(row.dataset.hm, row.dataset.key);
  };
  box.addEventListener('click', act);
  box.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-hm], .hm-card')) { e.preventDefault(); act(e); } });
});

const HM_COLORS = ['#ef7d9a', '#ffb86b', '#ffd66b', '#8fd3b0', '#7fb6f0', '#a99cf0', '#f2a3c9', '#9fd8cb', '#c9b6a6'];
function renderHome() {
  if (!hmBuilt) hmBuildScene();
  const d = hmData_ = hmData();
  hmDrawBuilding(d);
  if (!hmRaf) hmRaf = requestAnimationFrame(hmTick);
  if (hmPending.length) setTimeout(hmPlayPending, 800);

  const bal = d.inc - d.exp;
  const rate = d.inc ? Math.round(bal / d.inc * 100) : null;
  $('hmTitle').textContent = `${current} 收支總覽`;
  $('hmInc').textContent = money(d.inc);
  $('hmExp').textContent = money(d.exp);
  $('hmBal').textContent = money(bal);
  $('hmBal').className = bal >= 0 ? 'amt-inc' : 'amt-exp';
  $('hmRate').textContent = rate == null ? '—' : rate + '%';
  // 收入 vs 支出 對照條
  const mx = Math.max(d.inc, d.exp, 1);
  $('hmVs').innerHTML = `
    <div class="hm-vs-row"><span>💚 收入</span><i><b class="in" style="width:${(d.inc / mx * 100).toFixed(1)}%"></b></i><em>${hmShortMoney(d.inc)}</em></div>
    <div class="hm-vs-row"><span>🧾 支出</span><i><b class="out" style="width:${(d.exp / mx * 100).toFixed(1)}%"></b></i><em>${hmShortMoney(d.exp)}</em></div>
    ${d.prevSame != null && d.isNow ? `<p class="hm-note">上個月同期（1～${Number(todayIso().slice(8))} 號）支出 ${money(d.prevSame)}，這個月${d.exp >= d.prevSame ? '多' : '少'} <b class="${d.exp >= d.prevSame ? 'amt-exp' : 'amt-inc'}">${money(Math.abs(d.exp - d.prevSame))}</b></p>` : ''}
    ${d.prevTotal != null && !d.isNow ? `<p class="hm-note">上個月總支出 ${money(d.prevTotal)}</p>` : ''}`;
  // 支出占比（點一下分類展開這個分類的每一筆）
  const top = d.cats.slice(0, 8);
  const restCats = new Set(d.cats.slice(8).map(([n]) => n));
  const rest = d.cats.slice(8).reduce((s, [, v]) => s + v, 0);
  const pie = rest ? [...top, ['其他分類', rest]] : top;
  const expRecs = d.recs.filter(r => r.type !== '轉帳' && Number(r.expense) > 0);
  const incRecs = d.recs.filter(r => r.type !== '轉帳' && Number(r.income) > 0);
  $('hmExpList').innerHTML = pie.length ? pie.map(([n, v], i) => {
    const list = n === '其他分類' ? expRecs.filter(r => restCats.has(r.category || '未分類')) : expRecs.filter(r => (r.category || '未分類') === n);
    return hmShareRow('exp', n, v, d.exp, HM_COLORS[i % HM_COLORS.length], n === '其他分類' ? '🫧 其他分類' : catText(n), list);
  }).join('') : '<div class="empty">這個月還沒有支出</div>';
  $('hmExpPie').parentElement.classList.toggle('hidden', !pie.length || typeof Chart === 'undefined');
  if (pie.length) drawChart('hmExpPie', {
    type: 'doughnut',
    data: { labels: pie.map(([n]) => n), datasets: [{ data: pie.map(([, v]) => v), backgroundColor: pie.map((_, i) => HM_COLORS[i % HM_COLORS.length]), borderWidth: 2, borderColor: '#fff' }] },
    options: { cutout: '62%', onClick: (e, els) => { if (els[0]) hmToggle('exp', pie[els[0].index][0]); },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.label}：${money(c.raw)}（${Math.round(c.raw / d.exp * 100)}%）` } } } },
  });
  // 收入來源
  $('hmIncList').innerHTML = d.incCats.length ? d.incCats.map(([n, v]) =>
    hmShareRow('inc', n, v, d.inc, '#dc2626', catText(n), incRecs.filter(r => (r.category || '未分類') === n))).join('')
    : '<div class="empty">這個月還沒有收入</div>';
  // 本月轉帳（依路線，點一下展開）
  $('hmXferList').innerHTML = d.routes.length ? d.routes.map(([k, v]) =>
    hmShareRow('xfer', k, v, d.xferTotal, '#8a5fb5', k.replace('→', ' → '), d.xfers.filter(r => `${r.account || '?'}→${r.toAccount || '?'}` === k))).join('')
    : '<div class="empty">這個月還沒有轉帳</div>';
  $('hmXferNote').textContent = d.xfers.length ? `共 ${d.xfers.length} 筆、${money(d.xferTotal)}（轉帳不算收入或支出）` : '';
  // 上方四張卡片的細項
  $('hmCardDetail').innerHTML = hmCardDetail(d, expRecs, incRecs);
  document.querySelectorAll('#tab-home .hm-card').forEach(c => c.classList.toggle('open', hmOpen.card === c.dataset.card));
  // 近 6 個月
  const sorted = months.slice().sort((a, b) => sheetOrder(a) - sheetOrder(b));
  const end = sorted.indexOf(current);
  const six = sorted.slice(Math.max(0, end - 5), end + 1).filter(m => Array.isArray(monthData[m]));
  const val = (m, k) => sum(monthData[m].filter(r => r.type !== '轉帳'), k);
  $('hmTrendWrap').classList.toggle('hidden', six.length < 1);
  $('hmTrend').parentElement.classList.toggle('hidden', six.length < 2 || typeof Chart === 'undefined');
  $('hmMonthList').innerHTML = six.slice().reverse().map(m => hmMonthRow(m)).join('');
  if (six.length >= 2) drawChart('hmTrend', {
    type: 'bar',
    data: { labels: six.map(m => m.replace(/^\d{4}\//, '')), datasets: [
      { label: '收入', data: six.map(m => val(m, 'income')), backgroundColor: '#f87171', borderRadius: 6 },
      { label: '支出', data: six.map(m => val(m, 'expense')), backgroundColor: '#4ade80', borderRadius: 6 }] },
    options: { onClick: (e, els) => { if (els[0]) hmToggle('month', six[els[0].index]); },
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}：${money(c.raw)}` } } },
      scales: { y: { ticks: { callback: v => hmShortMoney(v) } } } },
  });
}
