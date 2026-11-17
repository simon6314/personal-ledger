// 我的帳本 — 首頁「我的帳本大樓」：上面是四層樓的動畫大樓（你＋三位小幫手，搭電梯跑來跑去），下面是本月收支與占比
// 依賴 app.js 的全域：monthRecords、current、months、monthData、allLoaded、accounts、balancesAsOf、
// isStockAcc、groupSum、sum、money、esc、catText、drawChart、todayIso、sheetOrder、mergeDividendFees

// ── 大樓設定（座標以 1000 × 1500 的大樓剖面為準）────────────────────
// 由上到下：屋頂、4F 股票交易室、3F 分析室、2F 老闆辦公室、1F 記帳大廳、街道
const HM_W = 1000, HM_H = 1500;
const HM_FT = { 4: 140, 3: 440, 2: 740, 1: 1040 };          // 各樓層天花板 y
const HM_FH = 300;
const hmFeet = f => HM_FT[f] + 272;                          // 該樓層站立的 y
const HM_LIFT_X = 935, HM_LIFT_DOOR = 858;                    // 電梯車廂中心、電梯門口
const HM_SPOTS = {
  stock: [330, 4], monitor: [520, 4], vault: [690, 4],
  chart: [560, 3], board: [300, 3], shelf: [740, 3],
  me: [470, 2], sofa: [720, 2], window: [230, 2],
  book: [300, 1], coffee: [600, 1], notice: [740, 1], door: [110, 1],
  meetBook: [380, 2], meetChart: [560, 2], meetStock: [610, 2],
};
const HM_ACTORS = [
  { id: 'me', name: '我', role: '老闆', seat: 'me', look: { skin: '#fcdcc4', hair: '#1f1d24', hs: 'side', cloth: '#3b4a6b', tie: '#ef7d9a', g: 'm' } },
  { id: 'book', name: '小記', role: '記帳員', seat: 'book', look: { skin: '#ffe4d0', hair: '#5b3a29', hs: 'bob', cloth: '#f7a8c0', g: 'f', glasses: true } },
  { id: 'chart', name: '小分', role: '分析員', seat: 'chart', look: { skin: '#fcdcc4', hair: '#2e2a30', hs: 'pony', cloth: '#9fd0f0', g: 'f' } },
  { id: 'stock', name: '小股', role: '股票員', seat: 'stock', look: { skin: '#f6d2b8', hair: '#3b2f2f', hs: 'short', cloth: '#4f6f5f', tie: '#ffd66b', g: 'm' } },
];
const HM_FLOOR_NAME = { 4: '4F 股票交易室', 3: '3F 分析室', 2: '2F 老闆辦公室', 1: '1F 記帳大廳' };
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
  return { recs, inc, exp, cats, incCats, todayCount, latest, biggest, isNow, prevSame, prevTotal, prevSheet, stockBal, divYear, count: recs.length };
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
  const top = a.pos[1] - HM_FT[a.floor] < 150 && a.floor === 4;
  a.bubEl.className = 'hm-bub show ' + cls + (top ? ' below' : '') + (a.pos[0] > 720 ? ' edge-r' : a.pos[0] < 250 ? ' edge-l' : '');
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
function hmDoors(open) { hmLift.doorEl.classList.toggle('open', open); return hmWait(450); }
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
async function hmGo(id, key) {
  const a = hmActors[id], s = hmSpot(key);
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
    const dy = hmLift.target - hmLift.y, step = 260 * dt;
    if (Math.abs(dy) <= step) { hmLift.y = hmLift.target; hmLift.target = null; const f = hmLift.done; hmLift.done = null; if (f) f(); }
    else hmLift.y += Math.sign(dy) * step;
    hmLift.el.style.top = (hmLift.y / HM_H * 100) + '%';
    const fl = [1, 2, 3, 4].reduce((b, f) => (Math.abs(HM_FT[f] - hmLift.y) < Math.abs(HM_FT[b] - hmLift.y) ? f : b), 1);
    $('hmLiftInd').textContent = `${fl}F`;
  }
  Object.values(hmActors).forEach(a => {
    if (a.riding) { a.pos[1] = hmLift.y + 272; hmPlace(a); return; }
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
async function hmIdle() {
  const free = Object.values(hmActors).filter(a => !a.busy);
  if (!free.length) return;
  const a = pk(free);
  const d = hmData_;
  const r = Math.random();
  a.busy = true;
  try {
    if (a.id !== 'me' && r < 0.32 && !hmActors.me.busy && hmActors.me.floor === 2) {
      // 搭電梯去 2F 找老闆報告
      const boss = hmActors.me;
      boss.busy = true;
      try {
        await hmGo(a.id, a.id === 'book' ? 'meetBook' : a.id === 'chart' ? 'meetChart' : 'meetStock');
        a.figEl.classList.toggle('flip', a.pos[0] > boss.pos[0]);
        boss.figEl.classList.toggle('flip', a.pos[0] < boss.pos[0]);
        for (const ln of hmReport(a.id, d)) { hmSay(ln.who, ln.text, 2800); await hmWait(2300); }
      } finally { boss.busy = false; boss.figEl.classList.remove('flip'); }
      await hmGo(a.id, a.seat);
    } else if (a.id === 'me' && r < 0.5) {
      // 老闆巡樓：倒咖啡、看白板、看盤、窗邊、沙發
      const where = pk(['coffee', 'board', 'monitor', 'window', 'sofa', 'notice', 'vault']);
      await hmGo('me', where);
      const text = {
        coffee: '來杯咖啡提神 ☕', board: d.cats[0] ? `原來${catText(d.cats[0][0])}花最多…` : '白板好乾淨 ✨',
        monitor: d.stockBal != null ? `股票帳戶 ${hmShortMoney(d.stockBal)}…穩住 📈` : '看一下盤 📈',
        window: hmNight() ? '夜景好美 🌃' : '今天天氣不錯 🌤️', sofa: '休息一下～ 🛋️',
        notice: d.latest ? `最新一筆是「${d.latest.item}」` : '公告欄空空的 📌', vault: d.inc - d.exp >= 0 ? '小豬撲滿又變胖了 🐷' : '撲滿要節食了 🐷',
      }[where];
      hmSay('me', text, 3200);
      a.el.classList.add(where === 'sofa' ? 'rest' : 'happy');
      // 遇到同一層的小幫手，順便打招呼
      const mate = Object.values(hmActors).find(x => x !== a && x.floor === a.floor && !x.busy);
      await hmWait(2400);
      if (mate) { hmSay(mate.id, pk(['老闆好！👋', '老闆來巡視了 😳', '老闆要喝咖啡嗎 ☕']), 2200); await hmWait(1600); }
      a.el.classList.remove('rest', 'happy');
      await hmGo('me', 'me');
    } else if (a.id !== 'me' && r < 0.5) {
      // 小幫手在自己樓層走動做事
      const near = { book: ['coffee', 'notice', 'door'], chart: ['board', 'shelf'], stock: ['monitor', 'vault'] }[a.id];
      const where = pk(near);
      await hmGo(a.id, where);
      hmSay(a.id, {
        coffee: '泡杯咖啡再繼續記 ☕', notice: '把最新的帳貼上公告欄 📌', door: '去信箱拿帳單 📬',
        board: '把白板的數字更新一下 ✏️', shelf: '翻一下上個月的報表 📚', monitor: '盯盤中…綠油油的別嚇我 😵', vault: '數數存錢筒 🐷',
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
function hmT(s, n) { const a = [...String(s || '')]; return esc(a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('')); }
function hmPlant(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="2" rx="22" ry="5" fill="rgba(70,40,20,.15)"/>
    <ellipse cx="-12" cy="-44" rx="14" ry="24" fill="#5f9e62" transform="rotate(-25 -12 -44)"/><ellipse cx="13" cy="-48" rx="14" ry="26" fill="#6fb06f" transform="rotate(22 13 -48)"/>
    <ellipse cx="0" cy="-62" rx="13" ry="22" fill="#82be7c"/><path d="M-12 -44 l6 10 M13 -48 l-6 11 M0 -62 v20" stroke="#4d8a52" stroke-width="2"/>
    <path d="M-17 -26 h34 l-5 28 h-24 Z" fill="#d98f5c"/><rect x="-19" y="-30" width="38" height="7" rx="3" fill="#c47a48"/></g>`;
}
function hmWindow(x, y, w, h, night) {
  const sky = night ? ['#1d2b4f', '#3a4a7a'] : ['#8fcff3', '#dff2fd'];
  return `<g><rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" rx="8" fill="#f7efe4" stroke="#d8c3a8" stroke-width="3"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${sky[0]}"/><rect x="${x}" y="${y + h * 0.55}" width="${w}" height="${h * 0.45}" fill="${sky[1]}" opacity=".55"/>
    ${night ? `<circle cx="${x + w * 0.75}" cy="${y + h * 0.28}" r="${h * 0.12}" fill="#fff6c8"/><circle cx="${x + w * 0.78}" cy="${y + h * 0.24}" r="${h * 0.1}" fill="${sky[0]}"/>
      <circle cx="${x + w * 0.2}" cy="${y + h * 0.2}" r="2" fill="#fff"/><circle cx="${x + w * 0.42}" cy="${y + h * 0.36}" r="1.6" fill="#fff"/><circle cx="${x + w * 0.58}" cy="${y + h * 0.15}" r="1.8" fill="#fff"/>`
      : `<circle cx="${x + w * 0.76}" cy="${y + h * 0.3}" r="${h * 0.12}" fill="#ffe08a"/><ellipse cx="${x + w * 0.3}" cy="${y + h * 0.35}" rx="${w * 0.15}" ry="${h * 0.07}" fill="#fff" opacity=".9"/>`}
    <path d="M${x} ${y + h * 0.72} q${w * 0.15} -${h * 0.18} ${w * 0.3} 0 t${w * 0.3} 0 t${w * 0.4} -${h * 0.05} V${y + h} H${x} Z" fill="${night ? '#2c3a5e' : '#9fcfae'}" opacity=".85"/>
    <path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="#f7efe4" stroke-width="6"/>
    <rect x="${x - 10}" y="${y + h + 4}" width="${w + 20}" height="8" rx="3" fill="#d8c3a8"/></g>`;
}
function hmFloorShell(f, wall, floorFill, night) {
  const y = HM_FT[f];
  return `<rect x="20" y="${y}" width="840" height="${HM_FH}" fill="${wall}"/>
    <rect x="20" y="${y + 200}" width="840" height="${HM_FH - 200}" fill="${floorFill}"/>
    <rect x="20" y="${y + 196}" width="840" height="8" fill="rgba(120,80,50,.25)"/>
    ${night ? `<rect x="20" y="${y}" width="840" height="${HM_FH}" fill="#203060" opacity=".12"/>` : ''}
    <ellipse cx="440" cy="${y + 22}" rx="300" ry="26" fill="#fff6d8" opacity="${night ? 0.35 : 0.18}"/>
    <path d="M300 ${y + 14} h280" stroke="#e8d9c4" stroke-width="5" stroke-linecap="round"/>
    <rect x="34" y="${y + 18}" width="142" height="30" rx="15" fill="rgba(255,255,255,.85)" stroke="rgba(0,0,0,.06)"/>
    <text x="105" y="${y + 39}" text-anchor="middle" font-size="18" font-weight="700" fill="#4a5568">${HM_FLOOR_NAME[f]}</text>`;
}
function hmDrawBuilding(d) {
  const night = hmNight();
  const now = new Date();
  const P = [];
  // 天空與背景大樓
  P.push(`<defs>
    <linearGradient id="hbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#141d3a' : '#8fd0f5'}"/><stop offset="1" stop-color="${night ? '#33406e' : '#e6f6ff'}"/></linearGradient>
    <pattern id="hbWood" width="120" height="24" patternUnits="userSpaceOnUse"><rect width="120" height="24" fill="#e8cfae"/><rect width="70" height="12" fill="#e2c6a2"/><rect x="35" y="12" width="85" height="12" fill="#ecd6b8"/><path d="M0 12 H120 M0 24 H120 M70 0 V12 M35 12 V24" stroke="#d3b48c" stroke-width="1"/></pattern>
    <pattern id="hbTile" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#e9ecf1"/><rect width="20" height="20" fill="#f3f5f8"/><rect x="20" y="20" width="20" height="20" fill="#f3f5f8"/></pattern>
    <pattern id="hbCarpet" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#c9d6e8"/><circle cx="15" cy="15" r="2" fill="#b7c6dc"/></pattern>
    <pattern id="hbBrick" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="#d9a588"/><path d="M0 15 H60 M0 30 H60 M30 0 V15 M0 15 V30 M60 15 V30" stroke="#c48a6c" stroke-width="2"/></pattern>
  </defs>`);
  P.push(`<rect width="${HM_W}" height="${HM_H}" fill="url(#hbSky)"/>`);
  if (night) P.push([...Array(26)].map((_, i) => `<circle cx="${(i * 137) % 1000}" cy="${(i * 53) % 130 + 6}" r="${i % 3 ? 1.6 : 2.4}" fill="#fff" opacity=".85"/>`).join(''));
  else P.push(`<g opacity=".95"><ellipse cx="150" cy="60" rx="60" ry="20" fill="#fff"/><ellipse cx="190" cy="48" rx="40" ry="20" fill="#fff"/><ellipse cx="760" cy="80" rx="70" ry="22" fill="#fff"/><ellipse cx="810" cy="66" rx="40" ry="18" fill="#fff"/></g>`);
  // 外牆
  P.push(`<rect x="8" y="${HM_FT[4] - 26}" width="${HM_W - 16}" height="${HM_FT[1] + HM_FH - HM_FT[4] + 30}" rx="10" fill="url(#hbBrick)"/>`);
  // 屋頂：招牌、天線、太陽能板
  P.push(`<rect x="0" y="${HM_FT[4] - 34}" width="${HM_W}" height="16" rx="6" fill="#8a5a44"/>
    <rect x="250" y="34" width="420" height="78" rx="18" fill="#0a9396" stroke="#06707a" stroke-width="5"/>
    <text x="460" y="88" text-anchor="middle" font-size="40" font-weight="800" fill="#fff" letter-spacing="4">📒 我的帳本大樓</text>
    <path d="M300 112 v26 M620 112 v26" stroke="#6b5444" stroke-width="6"/>
    <path d="M820 ${HM_FT[4] - 34} v-70" stroke="#6b6b75" stroke-width="5"/><circle cx="820" cy="${HM_FT[4] - 106}" r="7" fill="#ef5f7a" class="hb-blink"/>
    <g transform="translate(60 ${HM_FT[4] - 60})"><path d="M0 26 L20 0 H130 L110 26 Z" fill="#2f4a75"/><path d="M35 0 L15 26 M70 0 L50 26 M100 0 L80 26 M10 13 H120" stroke="#9fc0ea" stroke-width="2"/></g>`);
  // 電梯井
  P.push(`<rect x="872" y="${HM_FT[4]}" width="116" height="${HM_FT[1] + HM_FH - HM_FT[4]}" fill="#3a3f4b"/>
    <path d="M900 ${HM_FT[4]} V${HM_FT[1] + HM_FH} M970 ${HM_FT[4]} V${HM_FT[1] + HM_FH}" stroke="#555b69" stroke-width="3"/>`);
  [1, 2, 3, 4].forEach(f => P.push(`<rect x="862" y="${HM_FT[f] + 40}" width="14" height="236" fill="#c9ced8"/>`));

  // ── 4F 股票交易室 ──
  let y = HM_FT[4];
  P.push(hmFloorShell(4, '#e9eef6', 'url(#hbCarpet)', night));
  const candles = [...Array(9)].map((_, i) => {
    const up = (i * 7 + (d.stockBal || 3)) % 3 !== 0, h = 18 + (i * 13) % 30, x = 412 + i * 22, top = y + 110 - (i * 9) % 40;
    return `<path d="M${x + 6} ${top - 8} v${h + 16}" stroke="${up ? '#ef4444' : '#22c55e'}" stroke-width="2"/><rect x="${x}" y="${top}" width="12" height="${h}" fill="${up ? '#ef4444' : '#22c55e'}"/>`;
  }).join('');
  P.push(`<rect x="390" y="${y + 56}" width="230" height="120" rx="8" fill="#1f2533" stroke="#4a5160" stroke-width="5"/>${candles}
    <rect x="640" y="${y + 66}" width="120" height="100" rx="8" fill="#1f2533" stroke="#4a5160" stroke-width="5"/>
    <text x="700" y="${y + 100}" text-anchor="middle" font-size="15" fill="#9aa3b5">股票帳戶</text>
    <text x="700" y="${y + 132}" text-anchor="middle" font-size="22" font-weight="700" fill="#fca5a5">${d.stockBal != null ? hmShortMoney(d.stockBal) : '…'}</text>
    <text x="700" y="${y + 156}" text-anchor="middle" font-size="13" fill="#9aa3b5">今年股息 ${hmShortMoney(d.divYear)}</text>
    <rect x="220" y="${y + 66}" width="150" height="90" rx="8" fill="#1f2533" stroke="#4a5160" stroke-width="5"/>
    <polyline points="232,${y + 136} 256,${y + 118} 280,${y + 126} 304,${y + 96} 328,${y + 104} 356,${y + 82}" fill="none" stroke="#ef4444" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="200" y="${y + 18}" width="560" height="26" rx="6" fill="#111827"/>
    <clipPath id="hbTick"><rect x="214" y="${y + 18}" width="546" height="26"/></clipPath><text clip-path="url(#hbTick)" y="${y + 37}" font-size="16" font-weight="700" fill="#fbbf24" font-family="monospace">
      <tspan x="210">📈 股票帳戶 ${d.stockBal != null ? hmShortMoney(d.stockBal) : '…'} ▲　今年股息 ${hmShortMoney(d.divYear)}　長期投資 🐢　本月結餘 ${hmShortMoney(d.inc - d.exp)}</tspan>
      <animate attributeName="x" from="760" to="-300" dur="14s" repeatCount="indefinite"/></text>
    <rect x="200" y="${y + 18}" width="14" height="26" fill="#111827"/>
    <rect x="250" y="${y + 196}" width="300" height="20" rx="6" fill="#8a6a52"/><rect x="262" y="${y + 214}" width="12" height="40" fill="#6f5442"/><rect x="526" y="${y + 214}" width="12" height="40" fill="#6f5442"/>
    <rect x="300" y="${y + 184}" width="80" height="14" rx="3" fill="#d6dbe4"/><rect x="420" y="${y + 178}" width="44" height="20" rx="4" fill="#2f3542"/>
    <g transform="translate(700 ${y + 248}) scale(.85)"><rect x="-44" y="-56" width="88" height="62" rx="10" fill="#7d8796"/><rect x="-36" y="-48" width="72" height="46" rx="6" fill="#9aa4b2"/>
      <circle cx="0" cy="-25" r="14" fill="#c4cad4" stroke="#6b7482" stroke-width="3"/><path d="M0 -25 l9 -6" stroke="#6b7482" stroke-width="3"/></g>
    ${hmPlant(800, y + 270, 0.9)}`);

  // ── 3F 分析室 ──
  y = HM_FT[3];
  P.push(hmFloorShell(3, '#f5efe6', 'url(#hbWood)', night));
  const cats = d.cats.slice(0, 4);
  const cmax = cats.length ? cats[0][1] : 1;
  const colors = ['#ef7d9a', '#ffb86b', '#7fb6f0', '#8fd3b0'];
  const bars = cats.map(([n, v], i) => `<text x="214" y="${y + 92 + i * 30}" font-size="16" fill="#4a5568">${hmT(catText(n), 6)}</text>
    <rect x="300" y="${y + 79 + i * 30}" width="150" height="16" rx="8" fill="#eef1f4"/><rect x="300" y="${y + 79 + i * 30}" width="${Math.max(10, 150 * v / cmax).toFixed(0)}" height="16" rx="8" fill="${colors[i]}"/>
    <text x="500" y="${y + 92 + i * 30}" font-size="15" text-anchor="end" fill="#7b8094">${d.exp ? Math.round(v / d.exp * 100) : 0}%</text>`).join('')
    || `<text x="350" y="${y + 120}" text-anchor="middle" font-size="20" fill="#a8978a">還沒有支出 ✏️</text>`;
  // 圓餅圖
  let acc = 0;
  const pie = d.cats.slice(0, 4).map(([, v], i) => {
    const a0 = acc / d.exp * Math.PI * 2 - Math.PI / 2; acc += v; const a1 = acc / d.exp * Math.PI * 2 - Math.PI / 2;
    const cx = 590, cy = y + 120, r = 46, large = a1 - a0 > Math.PI ? 1 : 0;
    return `<path d="M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z" fill="${colors[i]}"/>`;
  }).join('');
  const ang = (now.getHours() % 12 + now.getMinutes() / 60) / 12 * 360, mang = now.getMinutes() / 60 * 360;
  P.push(`<rect x="196" y="${y + 50}" width="460" height="150" rx="10" fill="#c3ccd6"/><rect x="202" y="${y + 56}" width="448" height="138" rx="6" fill="#fff"/>
    <rect x="330" y="${y + 40}" width="150" height="24" rx="6" fill="#9aa8b6"/><text x="405" y="${y + 58}" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">本月支出分析</text>
    ${bars}${d.exp ? `<circle cx="590" cy="${y + 120}" r="48" fill="#eef1f4"/>${pie}<circle cx="590" cy="${y + 120}" r="22" fill="#fff"/><text x="590" y="${y + 125}" text-anchor="middle" font-size="12" fill="#7b8094">${hmShortMoney(d.exp)}</text>` : ''}
    <g transform="translate(760 ${y + 70})"><circle r="28" fill="#fff" stroke="#8a6a52" stroke-width="5"/><path d="M0 0 L0 -15" stroke="#3a3f4b" stroke-width="4" stroke-linecap="round" transform="rotate(${ang})"/><path d="M0 0 L0 -22" stroke="#3a3f4b" stroke-width="2.5" stroke-linecap="round" transform="rotate(${mang})"/><circle r="3" fill="#ef5f7a"/></g>
    <g transform="translate(700 ${y + 110})"><rect width="120" height="150" rx="6" fill="#a9785a"/><rect x="8" y="10" width="104" height="60" fill="#f2e6d6"/><rect x="8" y="80" width="104" height="62" fill="#f2e6d6"/>
      ${[0, 1, 2, 3, 4].map(i => `<rect x="${14 + i * 19}" y="${18 + (i % 2) * 4}" width="15" height="${48 - (i % 2) * 4}" rx="2" fill="${['#ef7d9a', '#7fb6f0', '#ffd66b', '#8fd3b0', '#a99cf0'][i]}"/>`).join('')}
      ${[0, 1, 2, 3].map(i => `<rect x="${16 + i * 24}" y="${92}" width="20" height="46" rx="2" fill="${['#5b6cf0', '#f2a03d', '#2f9e7a', '#d94f8a'][i]}"/>`).join('')}</g>
    <rect x="460" y="${y + 206}" width="220" height="18" rx="6" fill="#c99b72"/><rect x="472" y="${y + 222}" width="10" height="34" fill="#a9785a"/><rect x="658" y="${y + 222}" width="10" height="34" fill="#a9785a"/>
    <rect x="530" y="${y + 176}" width="66" height="32" rx="4" fill="#2f3542"/><rect x="534" y="${y + 180}" width="58" height="24" rx="2" fill="#7fb6f0"/><rect x="520" y="${y + 206}" width="86" height="5" rx="2" fill="#9aa3b5"/>
    <g transform="translate(640 ${y + 196})"><path d="M-8 -14 h16 l-2 14 h-12 Z" fill="#fff" stroke="#c9b6a6" stroke-width="2"/><path d="M8 -10 q8 0 6 6 q-2 4 -7 3" fill="none" stroke="#c9b6a6" stroke-width="2"/><path d="M-3 -18 q-3 -5 0 -9 M3 -18 q-3 -5 0 -9" stroke="#c9b6a6" stroke-width="1.5" fill="none" class="hb-steam"/></g>
    ${hmPlant(100, y + 270, 0.9)}`);

  // ── 2F 老闆辦公室 ──
  y = HM_FT[2];
  P.push(hmFloorShell(2, '#fbf3ea', 'url(#hbWood)', night));
  const bal = d.inc - d.exp;
  P.push(`${hmWindow(160, y + 56, 170, 120, night)}
    <ellipse cx="460" cy="${y + 262}" rx="190" ry="26" fill="#d9a7b4" opacity=".55"/><ellipse cx="460" cy="${y + 262}" rx="160" ry="18" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 6" opacity=".6"/>
    <g transform="translate(470 ${y + 70})"><rect x="-80" y="0" width="160" height="96" rx="8" fill="#c9a24a"/><rect x="-72" y="8" width="144" height="80" rx="4" fill="#fffaf0"/>
      <text x="0" y="32" text-anchor="middle" font-size="15" fill="#8a6a52">本月結餘</text>
      <text x="0" y="60" text-anchor="middle" font-size="24" font-weight="800" fill="${bal >= 0 ? '#dc2626' : '#16a34a'}">${bal >= 0 ? '+' : '−'}${hmShortMoney(Math.abs(bal))}</text>
      <text x="0" y="80" text-anchor="middle" font-size="13" fill="#8a6a52">儲蓄率 ${d.inc ? Math.round(bal / d.inc * 100) + '%' : '—'}</text></g>
    <rect x="360" y="${y + 196}" width="240" height="22" rx="8" fill="#7a5040"/><rect x="372" y="${y + 216}" width="216" height="44" rx="4" fill="#8f5e4a"/><rect x="380" y="${y + 224}" width="90" height="28" rx="3" fill="#7a5040"/><circle cx="460" cy="${y + 238}" r="3" fill="#e0c07a"/>
    <rect x="430" y="${y + 160}" width="80" height="38" rx="4" fill="#2f3542"/><rect x="434" y="${y + 164}" width="72" height="30" rx="2" fill="#7fd6d8"/><text x="470" y="${y + 186}" text-anchor="middle" font-size="18" font-weight="800" fill="#0a5c5f">$</text>
    <g transform="translate(560 ${y + 190})"><path d="M-6 -16 q-10 -14 6 -22 q14 6 4 22 Z" fill="#f7d36b"/><rect x="-10" y="-6" width="20" height="10" rx="2" fill="#5a4636"/></g>
    <g transform="translate(720 ${y + 200})"><rect x="-90" y="-50" width="180" height="40" rx="16" fill="#e7a07a"/><rect x="-100" y="-14" width="200" height="40" rx="14" fill="#d98a64"/><rect x="-104" y="-36" width="24" height="60" rx="10" fill="#c97955"/><rect x="80" y="-36" width="24" height="60" rx="10" fill="#c97955"/>
      <rect x="-50" y="-40" width="34" height="26" rx="8" fill="#fff3c8"/></g>
    <rect x="590" y="${y + 70}" width="70" height="86" rx="6" fill="#fff" stroke="#c9a24a" stroke-width="5"/><path d="M600 ${y + 140} l14 -24 l12 14 l10 -20 l14 30 Z" fill="#8fd3b0"/><circle cx="645" cy="${y + 92}" r="8" fill="#ffd66b"/>
    ${hmPlant(80, y + 270, 1)}
    <g transform="translate(820 ${y + 270})"><rect x="-6" y="-120" width="12" height="120" fill="#6b5444"/><path d="M-30 -120 h60 l-14 -36 h-32 Z" fill="#ffe8b0" stroke="#d8b878" stroke-width="2"/>${night ? '<ellipse cx="0" cy="-100" rx="60" ry="40" fill="#fff3c0" opacity=".3"/>' : ''}<ellipse cx="0" cy="0" rx="22" ry="5" fill="#6b5444"/></g>`);

  // ── 1F 記帳大廳 ──
  y = HM_FT[1];
  P.push(hmFloorShell(1, '#f3ece2', 'url(#hbTile)', night));
  const notes = d.recs.filter(r => r.item).slice().sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : (b.row || 0) - (a.row || 0))).slice(0, 3);
  const noteHtml = notes.map((r, i) => `<g transform="translate(${668 + i * 56} ${y + 84}) rotate(${[-4, 3, -2][i]})"><rect width="50" height="50" fill="${['#fff3a8', '#ffd1dc', '#c8f0ff'][i]}"/>
    <circle cx="25" cy="4" r="4" fill="#ef5f7a"/><text x="25" y="24" text-anchor="middle" font-size="11" fill="#4a3b30">${hmT(r.item, 4)}</text>
    <text x="25" y="40" text-anchor="middle" font-size="11" font-weight="700" fill="${r.income ? '#dc2626' : r.expense ? '#16a34a' : '#6b7280'}">${r.income ? '+' + hmShortMoney(r.income) : r.expense ? '−' + hmShortMoney(r.expense) : '⇄'}</text></g>`).join('');
  P.push(`<rect x="640" y="${y + 60}" width="200" height="110" rx="6" fill="#b98a5c"/><rect x="648" y="${y + 68}" width="184" height="94" rx="4" fill="#d9b48a"/>
    <text x="740" y="${y + 80}" text-anchor="middle" font-size="12" fill="#6b4c36" font-weight="700">最新紀錄</text>${noteHtml}
    <rect x="200" y="${y + 186}" width="240" height="70" rx="10" fill="#fff" stroke="#c9b6a6" stroke-width="3"/><rect x="200" y="${y + 186}" width="240" height="16" rx="8" fill="#0a9396"/>
    <g transform="translate(260 ${y + 166})"><path d="M-30 0 Q0 -12 30 0 V24 Q0 12 -30 24 Z" fill="#fff" stroke="#9aa3c4" stroke-width="2"/><path d="M0 -6 V18" stroke="#9aa3c4" stroke-width="2"/><path d="M-24 4 h18 M-24 10 h16 M6 4 h18 M6 10 h14" stroke="#c9cfe0" stroke-width="2"/></g>
    <g transform="translate(380 ${y + 168})"><rect x="-22" y="-6" width="44" height="28" rx="5" fill="#4a4a52"/><rect x="-14" y="-${12 + Math.min(d.todayCount, 6) * 5}" width="28" height="${10 + Math.min(d.todayCount, 6) * 5}" fill="#fff" stroke="#ddd"/>
      <text x="0" y="16" text-anchor="middle" font-size="11" fill="#7fffd0">今天 ${d.todayCount} 筆</text></g>
    <g transform="translate(560 ${y + 200})"><rect x="-38" y="-80" width="76" height="110" rx="10" fill="#7a5c48"/><rect x="-28" y="-68" width="56" height="30" rx="4" fill="#2f3542"/><text x="0" y="-48" text-anchor="middle" font-size="12" fill="#7fffd0">COFFEE</text>
      <rect x="-14" y="-26" width="28" height="12" fill="#3a2f2b"/><path d="M-8 -6 h16 l-2 14 h-12 Z" fill="#fff"/><path d="M-3 -10 q-3 -5 0 -10 M4 -10 q-3 -5 0 -10" stroke="#d9cfc5" stroke-width="2" fill="none" class="hb-steam"/></g>
    <g transform="translate(480 ${y + 40})"><rect x="-56" y="0" width="112" height="70" rx="6" fill="#fff" stroke="#c9b6a6" stroke-width="3"/>
      <text x="0" y="24" text-anchor="middle" font-size="14" fill="#7b8094">本月紀錄</text><text x="0" y="54" text-anchor="middle" font-size="26" font-weight="800" fill="#0a9396">${d.count} 筆</text></g>
    <g transform="translate(110 ${y + 66})"><rect x="-60" y="0" width="120" height="206" rx="6" fill="rgba(200,230,245,.55)" stroke="#9ab7c6" stroke-width="5"/><path d="M0 0 V206" stroke="#9ab7c6" stroke-width="4"/><circle cx="-10" cy="110" r="4" fill="#9ab7c6"/><circle cx="10" cy="110" r="4" fill="#9ab7c6"/>
      <text x="0" y="-8" text-anchor="middle" font-size="13" fill="#6b5444">入口</text></g>`);
  // 街道
  y = HM_FT[1] + HM_FH;
  P.push(`<rect x="0" y="${y}" width="${HM_W}" height="${HM_H - y}" fill="#c9ced8"/><rect x="0" y="${y}" width="${HM_W}" height="22" fill="#b6bcc8"/>
    ${[...Array(12)].map((_, i) => `<path d="M${i * 90 + 10} ${y + 22} v${HM_H - y - 22}" stroke="#bcc2cd" stroke-width="2"/>`).join('')}
    <g transform="translate(250 ${y + 152}) scale(.62)"><rect x="-8" y="-90" width="16" height="90" fill="#8a5a44"/><circle cx="0" cy="-110" r="46" fill="#6fb06f"/><circle cx="-26" cy="-92" r="30" fill="#5f9e62"/><circle cx="28" cy="-94" r="32" fill="#82be7c"/></g>
    <g transform="translate(560 ${y + 130})"><rect x="-4" y="-130" width="8" height="130" fill="#4a4f5c"/><rect x="-18" y="-140" width="36" height="16" rx="6" fill="#4a4f5c"/><ellipse cx="0" cy="-124" rx="14" ry="5" fill="${night ? '#fff3b0' : '#e9ecf1'}"/>${night ? '<ellipse cx="0" cy="-60" rx="50" ry="70" fill="#fff3b0" opacity=".18"/>' : ''}</g>
    <g transform="translate(760 ${y + 120})"><rect x="-4" y="-40" width="8" height="40" fill="#4a4f5c"/><rect x="-24" y="-80" width="48" height="40" rx="12" fill="#ef5f7a"/><rect x="-14" y="-66" width="28" height="5" rx="2" fill="#7a2f3d"/><text x="0" y="-48" text-anchor="middle" font-size="10" fill="#fff">帳單</text></g>`);
  $('hmScene').querySelector('.hm-room').innerHTML = `<svg viewBox="0 0 ${HM_W} ${HM_H}" preserveAspectRatio="none" aria-hidden="true">${P.join('')}</svg>`;
}
function hmBuildScene() {
  const box = $('hmScene');
  box.innerHTML = `<div class="hm-room"></div><div class="hm-lift"><div class="hm-lift-doors"><i></i><i></i></div><span id="hmLiftInd" class="hm-lift-ind">1F</span></div>`;
  hmLift.el = box.querySelector('.hm-lift');
  hmLift.doorEl = box.querySelector('.hm-lift-doors');
  hmLift.el.style.top = (hmLift.y / HM_H * 100) + '%';
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

const HM_COLORS = ['#ef7d9a', '#ffb86b', '#ffd66b', '#8fd3b0', '#7fb6f0', '#a99cf0', '#f2a3c9', '#9fd8cb', '#c9b6a6'];
function renderHome() {
  if (!hmBuilt) hmBuildScene();
  const d = hmData_ = hmData();
  hmDrawBuilding(d);
  if (!hmRaf) hmRaf = requestAnimationFrame(hmTick);

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
  // 支出占比
  const top = d.cats.slice(0, 8);
  const rest = d.cats.slice(8).reduce((s, [, v]) => s + v, 0);
  const pie = rest ? [...top, ['其他分類', rest]] : top;
  $('hmExpList').innerHTML = pie.length ? pie.map(([n, v], i) => `
    <div class="hm-share"><i style="background:${HM_COLORS[i % HM_COLORS.length]}"></i><span>${esc(n === '其他分類' ? '🫧 其他分類' : catText(n))}</span>
      <em class="bar"><b style="width:${(v / d.exp * 100).toFixed(1)}%;background:${HM_COLORS[i % HM_COLORS.length]}"></b></em><strong>${Math.round(v / d.exp * 100)}%</strong><small>${money(v)}</small></div>`).join('')
    : '<div class="empty">這個月還沒有支出</div>';
  $('hmExpPie').parentElement.classList.toggle('hidden', !pie.length || typeof Chart === 'undefined');
  if (pie.length) drawChart('hmExpPie', {
    type: 'doughnut',
    data: { labels: pie.map(([n]) => n), datasets: [{ data: pie.map(([, v]) => v), backgroundColor: pie.map((_, i) => HM_COLORS[i % HM_COLORS.length]), borderWidth: 2, borderColor: '#fff' }] },
    options: { cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.label}：${money(c.raw)}（${Math.round(c.raw / d.exp * 100)}%）` } } } },
  });
  // 收入來源
  $('hmIncList').innerHTML = d.incCats.length ? d.incCats.map(([n, v], i) => `
    <div class="hm-share"><i style="background:#f87171"></i><span>${esc(catText(n))}</span>
      <em class="bar"><b style="width:${(v / d.inc * 100).toFixed(1)}%;background:#dc2626"></b></em><strong>${Math.round(v / d.inc * 100)}%</strong><small>${money(v)}</small></div>`).join('')
    : '<div class="empty">這個月還沒有收入</div>';
  // 近 6 個月
  const sorted = months.slice().sort((a, b) => sheetOrder(a) - sheetOrder(b));
  const end = sorted.indexOf(current);
  const six = sorted.slice(Math.max(0, end - 5), end + 1).filter(m => Array.isArray(monthData[m]));
  const val = (m, k) => sum(monthData[m].filter(r => r.type !== '轉帳'), k);
  $('hmTrendWrap').classList.toggle('hidden', six.length < 2 || typeof Chart === 'undefined');
  if (six.length >= 2) drawChart('hmTrend', {
    type: 'bar',
    data: { labels: six.map(m => m.replace(/^\d{4}\//, '')), datasets: [
      { label: '收入', data: six.map(m => val(m, 'income')), backgroundColor: '#f87171', borderRadius: 6 },
      { label: '支出', data: six.map(m => val(m, 'expense')), backgroundColor: '#4ade80', borderRadius: 6 }] },
    options: { plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}：${money(c.raw)}` } } },
      scales: { y: { ticks: { callback: v => hmShortMoney(v) } } } },
  });
}
