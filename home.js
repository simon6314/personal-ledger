// 我的帳本 — 首頁「我的辦公室」：上面是動畫辦公室（你＋三位小幫手），下面是本月收支與占比
// 依賴 app.js 的全域：monthRecords、current、months、monthData、allLoaded、accounts、balancesAsOf、
// isStockAcc、groupSum、sum、money、esc、catText、drawChart、todayIso、sheetOrder、mergeDividendFees

// ── 場景設定（座標以 1000 × 520 的房間為準）────────────────────────
const HM_W = 1000, HM_H = 520;
const HM_SPOTS = {
  me: [500, 330], book: [190, 360], chart: [770, 330], stock: [880, 470],
  coffee: [80, 220], sofa: [330, 470], window: [520, 200], plant: [960, 250],
  meetBook: [430, 360], meetChart: [570, 360], meetStock: [560, 400],
};
const HM_ACTORS = [
  { id: 'me', name: '我', role: '老闆', seat: 'me', look: { skin: '#fcdcc4', hair: '#1f1d24', hs: 'side', cloth: '#3b4a6b', tie: '#ef7d9a', g: 'm' } },
  { id: 'book', name: '小記', role: '記帳員', seat: 'book', look: { skin: '#ffe4d0', hair: '#5b3a29', hs: 'bob', cloth: '#f7a8c0', g: 'f', glasses: true } },
  { id: 'chart', name: '小分', role: '分析員', seat: 'chart', look: { skin: '#fcdcc4', hair: '#2e2a30', hs: 'pony', cloth: '#9fd0f0', g: 'f' } },
  { id: 'stock', name: '小股', role: '股票員', seat: 'stock', look: { skin: '#f6d2b8', hair: '#3b2f2f', hs: 'short', cloth: '#4f6f5f', tie: '#ffd66b', g: 'm' } },
];

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
let hmActors = {}, hmRaf = 0, hmLast = 0, hmData_ = null, hmNext = 0, hmBuilt = false;
function hmPlace(a) {
  a.el.style.left = (a.pos[0] / HM_W * 100) + '%';
  a.el.style.top = (a.pos[1] / HM_H * 100) + '%';
  a.el.style.zIndex = String(Math.round(a.pos[1]) + (a.bub ? 1000 : 0));
}
function hmSay(id, text, ms = 3000, cls = '') {
  const a = hmActors[id];
  if (!a) return;
  clearTimeout(a.bt);
  a.bubEl.textContent = text;
  a.bubEl.className = 'hm-bub show ' + cls + (a.pos[1] < 150 ? ' below' : '') + (a.pos[0] > 760 ? ' edge-r' : a.pos[0] < 240 ? ' edge-l' : '');   // 靠邊時泡泡往內長，不被切掉
  a.bub = true; hmPlace(a);
  a.bt = setTimeout(() => { a.bubEl.className = 'hm-bub'; a.bub = false; hmPlace(a); }, ms);
}
function hmWalk(id, spot) {
  const a = hmActors[id];
  return new Promise(res => { a.target = HM_SPOTS[spot] || spot; a.done = res; a.el.classList.add('walk'); });
}
const hmWait = ms => new Promise(r => setTimeout(r, ms));
function hmTick(now) {
  hmRaf = requestAnimationFrame(hmTick);
  const dt = Math.min(0.1, hmLast ? (now - hmLast) / 1000 : 0);
  hmLast = now;
  Object.values(hmActors).forEach(a => {
    if (!a.target) return;
    const dx = a.target[0] - a.pos[0], dy = a.target[1] - a.pos[1], dist = Math.hypot(dx, dy), step = 110 * dt;
    if (Math.abs(dx) > 1) a.figEl.classList.toggle('flip', dx < 0);
    if (dist <= step) {
      a.pos = a.target.slice(); a.target = null; a.el.classList.remove('walk');
      const f = a.done; a.done = null; if (f) f();
    } else { a.pos[0] += dx / dist * step; a.pos[1] += dy / dist * step; }
    hmPlace(a);
  });
  if (now > hmNext && hmData_) { hmNext = now + 4000 + Math.random() * 5000; hmIdle(); }
}
async function hmIdle() {
  const free = Object.values(hmActors).filter(a => !a.busy);
  if (!free.length) return;
  const a = pk(free);
  const d = hmData_;
  const r = Math.random();
  a.busy = true;
  try {
    if (a.id !== 'me' && r < 0.3 && !hmActors.me.busy) {
      // 去找老闆報告
      hmActors.me.busy = true;
      await hmWalk(a.id, a.id === 'book' ? 'meetBook' : a.id === 'chart' ? 'meetChart' : 'meetStock');
      a.figEl.classList.toggle('flip', a.pos[0] > hmActors.me.pos[0]);
      hmActors.me.figEl.classList.toggle('flip', a.pos[0] < hmActors.me.pos[0]);
      for (const ln of hmReport(a.id, d)) { hmSay(ln.who, ln.text, 2600); await hmWait(2100); }
      hmActors.me.busy = false;
      await hmWalk(a.id, a.seat);
    } else if (a.id === 'me' && r < 0.45) {
      const where = pk(['coffee', 'sofa', 'window', 'plant']);
      await hmWalk('me', where);
      hmSay('me', { coffee: '來杯咖啡 ☕', sofa: '休息一下～ 🛋️', window: '今天天氣如何呢 🌤️', plant: '幫盆栽澆水 🌱' }[where]);
      a.el.classList.add(where === 'sofa' ? 'rest' : 'happy');
      await hmWait(3500);
      a.el.classList.remove('rest', 'happy');
      await hmWalk('me', 'me');
    } else {
      hmSay(a.id, hmLine(a.id, d));
      a.el.classList.add('happy');
      await hmWait(1200);
      a.el.classList.remove('happy');
    }
  } finally { a.busy = false; a.figEl.classList.remove('flip'); }
}

// ── 場景畫面 ─────────────────────────────────────────────────
function hmRoomSvg(d) {
  const bars = (d.cats.slice(0, 4).length ? d.cats.slice(0, 4) : [['', 0]]).map(([, v], i, arr) => {
    const max = arr[0][1] || 1, h = Math.max(6, v / max * 70);
    return `<rect x="${700 + i * 32}" y="${265 - h}" width="22" height="${h}" rx="3" fill="${['#ef7d9a', '#ffd66b', '#7fb6f0', '#8fd3b0'][i]}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${HM_W} ${HM_H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="hmWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf3e7"/><stop offset="1" stop-color="#f8e8d6"/></linearGradient>
      <pattern id="hmFloor" width="80" height="40" patternUnits="userSpaceOnUse"><rect width="80" height="40" fill="#e9d3b8"/><path d="M0 20 H80 M40 0 V20 M0 40 H80 M20 20 V40 M60 20 V40" stroke="#dcc2a3" stroke-width="1"/></pattern>
      <linearGradient id="hmSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd4f5"/><stop offset="1" stop-color="#dff2fd"/></linearGradient></defs>
    <rect width="${HM_W}" height="250" fill="url(#hmWall)"/><rect y="250" width="${HM_W}" height="${HM_H - 250}" fill="url(#hmFloor)"/>
    <rect y="244" width="${HM_W}" height="8" fill="#c99b72"/>
    <!-- 窗戶 -->
    <rect x="430" y="40" width="180" height="140" rx="10" fill="url(#hmSky)" stroke="#fff" stroke-width="8"/><path d="M520 40 V180 M430 110 H610" stroke="#fff" stroke-width="6"/>
    <circle cx="575" cy="75" r="14" fill="#ffe08a"/><ellipse cx="470" cy="140" rx="26" ry="10" fill="#fff" opacity=".9"/>
    <!-- 招牌 -->
    <rect x="40" y="40" width="250" height="56" rx="12" fill="#0a9396"/><text x="165" y="77" text-anchor="middle" font-size="26" font-weight="700" fill="#fff">📒 我的帳本辦公室</text>
    <!-- 記帳桌 -->
    <rect x="110" y="300" width="160" height="56" rx="8" fill="#c99b72"/><rect x="110" y="300" width="160" height="12" rx="6" fill="#d9ad84"/>
    <rect x="150" y="282" width="46" height="24" rx="3" fill="#fff" stroke="#e0c7a8"/><path d="M173 282 V306" stroke="#e0c7a8"/><path d="M156 290 h12 M156 296 h12 M178 290 h12 M178 296 h10" stroke="#9aa3c4" stroke-width="2"/>
    <rect x="212" y="286" width="22" height="18" rx="3" fill="#ffd66b"/><text x="223" y="300" text-anchor="middle" font-size="12">🧾</text>
    <!-- 老闆桌 -->
    <rect x="410" y="270" width="190" height="60" rx="8" fill="#a9785a"/><rect x="410" y="270" width="190" height="12" rx="6" fill="#bb8c6b"/>
    <rect x="470" y="232" width="70" height="44" rx="4" fill="#2f3542"/><rect x="474" y="236" width="62" height="34" rx="2" fill="#7fd6d8"/><text x="505" y="259" text-anchor="middle" font-size="16" font-weight="700" fill="#2f3542">$</text>
    <circle cx="575" cy="262" r="9" fill="#fff" stroke="#c99b72" stroke-width="2"/>
    <!-- 白板 -->
    <rect x="680" y="160" width="160" height="120" rx="8" fill="#fff" stroke="#c9b6a6" stroke-width="4"/>
    <text x="760" y="184" text-anchor="middle" font-size="14" fill="#7b8094">支出前四名</text>${bars}
    <!-- 股票螢幕 -->
    <rect x="850" y="330" width="120" height="80" rx="6" fill="#2f3542"/><polyline points="860,395 880,380 900,388 920,360 940,368 960,345" fill="none" stroke="#8fd3b0" stroke-width="4" stroke-linecap="round"/>
    <rect x="895" y="410" width="30" height="20" fill="#4a4a52"/>
    <!-- 咖啡機、沙發、盆栽 -->
    <rect x="40" y="150" width="80" height="90" rx="10" fill="#7a5c48"/><rect x="55" y="165" width="50" height="26" rx="4" fill="#2f3542"/><circle cx="80" cy="212" r="10" fill="#ef7d9a"/>
    <rect x="250" y="440" width="170" height="60" rx="20" fill="#9fb7e8"/><rect x="250" y="420" width="170" height="34" rx="16" fill="#b8cbf0"/>
    <rect x="920" y="200" width="44" height="40" rx="6" fill="#d98f5c"/><ellipse cx="930" cy="185" rx="16" ry="26" fill="#6aa86b"/><ellipse cx="955" cy="180" rx="16" ry="28" fill="#82be7c"/>
  </svg>`;
}
function hmBuildScene() {
  const box = $('hmScene');
  box.innerHTML = `<div class="hm-room"></div>`;
  hmActors = {};
  HM_ACTORS.forEach(c => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hm-actor';
    el.innerHTML = `<span class="hm-fig">${hmPerson(c.look)}</span><span class="hm-tag">${esc(c.name)}</span><span class="hm-bub"></span>`;
    const a = { ...c, el, figEl: el.querySelector('.hm-fig'), bubEl: el.querySelector('.hm-bub'), pos: HM_SPOTS[c.seat].slice(), busy: false };
    el.addEventListener('click', () => { if (hmData_) { hmSay(c.id, `${c.name}（${c.role}）：${hmLine(c.id, hmData_)}`, 3600); el.classList.add('happy'); setTimeout(() => el.classList.remove('happy'), 900); } });
    box.appendChild(el);
    hmActors[c.id] = a;
    hmPlace(a);
  });
  hmBuilt = true;
}

// ── 首頁（會被 renderCurrentTab 呼叫）───────────────────────────
const HM_COLORS = ['#ef7d9a', '#ffb86b', '#ffd66b', '#8fd3b0', '#7fb6f0', '#a99cf0', '#f2a3c9', '#9fd8cb', '#c9b6a6'];
function renderHome() {
  if (!hmBuilt) hmBuildScene();
  const d = hmData_ = hmData();
  $('hmScene').querySelector('.hm-room').innerHTML = hmRoomSvg(d);
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
