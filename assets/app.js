/* Warsh Watch - dependency-free dashboard renderer. Data: window.WARSH_DATA (data/data.js). */
(function () {
  'use strict';
  const DATA = window.WARSH_DATA;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (!DATA || !DATA.series) {
    document.getElementById('sections').textContent = 'Data file failed to load.';
    return;
  }

  // ------------------------------------------------------------------ data helpers
  const toTime = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const raw = (key) => (DATA.series[key] || []).map(([d, v]) => ({ d, t: toTime(d), v }));
  const ym = (d) => d.slice(0, 7);
  function shiftYm(d, months) {
    let y = +d.slice(0, 4), m = +d.slice(5, 7) - 1 - months;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  // Percent change over `months`, optionally annualized (for monthly / quarterly series).
  function pct(key, months, annualize) {
    const obs = raw(key), byYm = new Map(obs.map((o) => [ym(o.d), o.v]));
    const out = [];
    for (const o of obs) {
      let base = byYm.get(shiftYm(o.d, months));
      if (base == null) {
        // Bridge a single missing month (e.g. Oct 2025 CPI, never published due to the
        // government shutdown) with the geometric mean of its neighbours.
        const a = byYm.get(shiftYm(o.d, months + 1)), b = byYm.get(shiftYm(o.d, months - 1));
        if (a > 0 && b > 0 && months > 1) base = Math.sqrt(a * b);
      }
      if (base == null || base <= 0) continue;
      const r = o.v / base;
      out.push({ d: o.d, t: o.t, v: 100 * ((annualize ? Math.pow(r, 12 / months) : r) - 1) });
    }
    return out;
  }
  const level = (key, scale = 1) => raw(key).map((o) => ({ ...o, v: o.v * scale }));
  function diff(key) {
    const obs = raw(key), out = [];
    for (let i = 1; i < obs.length; i++) out.push({ d: obs[i].d, t: obs[i].t, v: obs[i].v - obs[i - 1].v });
    return out;
  }
  const last = (arr) => arr[arr.length - 1];

  // ------------------------------------------------------------------ formatting
  function fmtDate(d, freq) {
    const y = d.slice(0, 4), m = +d.slice(5, 7);
    if (freq === 'Q') return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
    if (freq === 'M') return `${MONTHS[m - 1]} ${y}`;
    return `${MONTHS[m - 1]} ${+d.slice(8, 10)}, ${y}`;
  }
  function fmtVal(v, unit, digits = 1) {
    if (v == null || !isFinite(v)) return '–';
    const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const sign = v < 0 ? '−' : '';
    switch (unit) {
      case '%': return `${sign}${s}%`;
      case 'pp': return `${sign}${s} pp`;
      case '$T': return `${sign}$${s}T`;
      case 'K': return `${sign}${s}K`;
      default: return `${sign}${s}`;
    }
  }

  // ------------------------------------------------------------------ panel definitions
  const n = DATA.breadth ? DATA.breadth.components : 220;
  const preAvg = DATA.breadth ? DATA.breadth.preAvg12m : null;

  const SECTIONS = [
    {
      title: 'Inflation',
      note: 'Warsh made inflation the center of the speech. His test: <q>We must be confident that underlying inflation is moving to our objective.</q> He called 2% PCE a <q>firm, fixed target.</q>',
      panels: [
        { title: 'PCE inflation', sub: 'Price index for personal consumption expenditures, % change', unit: '%', freq: 'M',
          series: [
            { label: '12-month', get: () => pct('PCEPI', 12) },
            { label: '6-month, annualized', get: () => pct('PCEPI', 6, true) },
            { label: 'Core, 12-month', get: () => pct('PCEPILFE', 12) }],
          refs: [{ y: 2, label: '2% target' }],
          speech: 'At Jackson Hole: 3.7% over 12 months, 4.1% over 6 months (July data)', source: 'BEA via FRED: PCEPI, PCEPILFE' },
        { title: 'Breadth of price increases', sub: `Share of ${n} PCE components with inflation above 3%`, unit: '%', freq: 'M', digits: 0,
          series: [
            { label: '12-month', get: () => raw('BREADTH_12M') },
            { label: '6-month, annualized', get: () => raw('BREADTH_6M') }],
          refs: preAvg ? [{ y: preAvg, label: `2000–19 avg ${Math.round(preAvg)}%` }] : [],
          speech: 'At Jackson Hole: 54% over 12 months, 49% over 6 months, against 32% before the pandemic', source: 'Calculated from BEA NIPA Table 2.4.4U' },
        { title: 'Trimmed and median PCE', sub: 'Measures that drop outlier price changes, 12-month %', unit: '%', freq: 'M',
          series: [
            { label: 'Dallas Fed trimmed mean', get: () => raw('PCETRIM12M159SFRBDAL') },
            { label: 'Cleveland Fed median', get: () => raw('MEDPCE_CLE') }],
          refs: [{ y: 2, label: '2% target' }],
          speech: 'Confirmation hearing (Apr 2026): trimmed mean 2.3%, median 2.8%', source: 'Dallas Fed via FRED; Cleveland Fed' },
        { title: 'CPI inflation', sub: 'Consumer price index, 12-month %', unit: '%', freq: 'M',
          series: [
            { label: 'All items', get: () => pct('CPIAUCSL', 12) },
            { label: 'Core (ex food & energy)', get: () => pct('CPILFESL', 12) }],
          speech: 'At Jackson Hole: CPI and core measures are <q>also elevated</q>', source: 'BLS via FRED: CPIAUCSL, CPILFESL' },
        { title: 'Inflation expectations', sub: 'Market-implied and survey measures, %', unit: '%', freq: 'W',
          series: [
            { label: '5y5y forward', get: () => raw('T5YIFR') },
            { label: '5-year breakeven', get: () => raw('T5YIE') },
            { label: 'Michigan 1-year', get: () => raw('MICH') }],
          speech: 'At Jackson Hole: medium-term expectations <q>by and large, look stable</q>', source: 'Federal Reserve, U. Michigan via FRED' },
        { title: 'Commodity prices', sub: 'IMF all-commodity price index, 12-month %', unit: '%', freq: 'M',
          series: [{ label: 'All commodities', get: () => pct('PALLFNFINDEXM', 12) }], zero: true,
          speech: 'At Jackson Hole: the rise in commodity prices <q>also bears watching</q>', source: 'IMF via FRED: PALLFNFINDEXM' },
        { title: 'Wage growth', sub: '% change from a year earlier', unit: '%', freq: 'M',
          series: [
            { label: 'Atlanta Fed wage tracker', get: () => raw('FRBATLWGT3MMAUMHWGO') },
            { label: 'ECI wages & salaries', get: () => pct('ECIWAG', 12), freq: 'Q' }],
          speech: 'At Jackson Hole: wage growth is moderate and <q>not</q> a reliable inflation signal', source: 'Atlanta Fed, BLS via FRED' },
      ],
    },
    {
      title: 'Demand and activity',
      note: 'Warsh\'s second principle: demand should match supply, but supply can\'t be observed directly. These are the demand gauges he cited.',
      panels: [
        { title: 'Private domestic final purchases', sub: 'Real final sales to private domestic purchasers, 4-quarter %', unit: '%', freq: 'Q',
          series: [{ label: 'Real PDFP', get: () => pct('LB0000031Q020SBEA', 12) }], zero: true,
          speech: 'At Jackson Hole: <q>nearly 3 percent</q> so far this year. He said it carries more signal than GDP', source: 'BEA via FRED: LB0000031Q020SBEA' },
        { title: 'Real consumer spending', sub: 'Real PCE, 12-month %', unit: '%', freq: 'M',
          series: [{ label: 'Real PCE', get: () => pct('PCEC96', 12) }], zero: true,
          speech: 'At Jackson Hole: up more than 2% over the past four quarters', source: 'BEA via FRED: PCEC96' },
        { title: 'Business investment', sub: 'Real private fixed investment, 4-quarter %', unit: '%', freq: 'Q',
          series: [
            { label: 'Equipment', get: () => pct('Y033RX1Q020SBEA', 12) },
            { label: 'Intellectual property', get: () => pct('Y001RX1Q020SBEA', 12) }], zero: true,
          speech: 'At Jackson Hole: equipment and intangibles up about 9%, more than half from the AI buildout', source: 'BEA via FRED' },
        { title: 'Corporate profits', sub: 'U.S. corporate profits after tax (national accounts), 4-quarter %', unit: '%', freq: 'Q',
          series: [{ label: 'Corporate profits', get: () => pct('CP', 12) }], zero: true,
          speech: 'At Jackson Hole: S&P 500 profits up more than 20% (economy-wide profits shown here)', source: 'BEA via FRED: CP' },
      ],
    },
    {
      title: 'Labor market',
      note: 'Warsh said the labor market is <q>consistent with full employment.</q> He singled out jobless claims as an <q>empirically robust real-time indicator.</q>',
      panels: [
        { title: 'Unemployment rate', sub: '%', unit: '%', freq: 'M',
          series: [{ label: 'Unemployment rate', get: () => raw('UNRATE') }],
          speech: 'At Jackson Hole: 4.1%, <q>low by historical standards</q>', source: 'BLS via FRED: UNRATE' },
        { title: 'Initial jobless claims', sub: '4-week average, thousands', unit: 'K', freq: 'W', digits: 0,
          series: [{ label: 'Claims, 4-wk avg', get: () => level('IC4WSA', 1 / 1000) }],
          speech: 'At Jackson Hole: <q>near their lowest level in decades</q>', source: 'DOL via FRED: IC4WSA' },
        { title: 'Payroll job gains', sub: 'Monthly change in nonfarm payrolls, thousands', unit: 'K', freq: 'M', digits: 0, kind: 'bar',
          series: [{ label: 'Monthly change', get: () => diff('PAYEMS') }], zero: true,
          speech: 'At Jackson Hole: monthly gains will <q>naturally</q> run low as labor supply barely grows', source: 'BLS via FRED: PAYEMS' },
      ],
    },
    {
      title: 'Financial conditions',
      note: 'Warsh: <q>Credit and loan markets are showing few signs of policy restraint.</q> He said he would be hard pressed to call broad conditions restrictive.',
      panels: [
        { title: 'Policy rate and Treasury yields', sub: '%', unit: '%', freq: 'W', digits: 2,
          series: [
            { label: 'Fed funds (upper)', get: () => raw('DFEDTARU') },
            { label: '2-year', get: () => raw('DGS2') },
            { label: '10-year', get: () => raw('DGS10') }],
          speech: 'Warsh: short-term rates are the Fed\'s <q>predominant tool</q>', source: 'Federal Reserve via FRED' },
        { title: 'Corporate bond spreads', sub: 'Option-adjusted spread over Treasuries, percentage points', unit: 'pp', freq: 'W', digits: 2,
          series: [
            { label: 'High yield', get: () => raw('BAMLH0A0HYM2') },
            { label: 'Investment grade', get: () => raw('BAMLC0A0CM') }],
          speech: 'At Jackson Hole: spreads <q>near the low ends of their historical ranges</q>', source: 'ICE BofA via FRED' },
        { title: 'Bank lending standards', sub: 'Net % of banks tightening C&I loan standards (large & mid firms)', unit: '%', freq: 'Q', digits: 1,
          series: [{ label: 'Net tightening', get: () => raw('DRTSCILM') }], zero: true,
          speech: 'At Jackson Hole: standards <q>on the easier end</q> of their range (July survey)', source: 'Fed SLOOS via FRED: DRTSCILM' },
        { title: 'Stock market volatility', sub: 'Cboe VIX index', unit: '', freq: 'W',
          series: [{ label: 'VIX', get: () => raw('VIXCLS') }],
          speech: 'At Jackson Hole: equity volatility is <q>low</q>', source: 'Cboe via FRED: VIXCLS' },
        { title: 'U.S. dollar', sub: 'Nominal broad trade-weighted dollar index (Jan 2006 = 100)', unit: '', freq: 'W',
          series: [{ label: 'Broad dollar', get: () => raw('DTWEXBGS') }],
          speech: 'Warsh listed the dollar\'s value among the market signals he watches', source: 'Federal Reserve via FRED: DTWEXBGS' },
      ],
    },
    {
      title: 'Money and the balance sheet',
      note: 'Warsh\'s sixth principle: <q>money matters.</q> That covers money created by the Fed and money from the banking system. He has long argued for a smaller Fed balance sheet.',
      panels: [
        { title: 'Fed balance sheet', sub: 'Total assets, $ trillions', unit: '$T', freq: 'W', digits: 2,
          series: [{ label: 'Total assets', get: () => level('WALCL', 1 / 1e6) }],
          speech: 'Not discussed at Jackson Hole. Warsh has long favored a smaller balance sheet', source: 'Federal Reserve via FRED: WALCL' },
        { title: 'Money growth', sub: '12-month %', unit: '%', freq: 'M',
          series: [
            { label: 'M2', get: () => pct('M2SL', 12) },
            { label: 'Monetary base', get: () => pct('BOGMBASE', 12) }], zero: true,
          speech: 'At Jackson Hole: the Fed <q>should pay attention to money</q> from both sources', source: 'Federal Reserve via FRED: M2SL, BOGMBASE' },
      ],
    },
  ];

  // ------------------------------------------------------------------ tiles
  function renderTiles() {
    const el = document.getElementById('tiles');
    const lo = last(raw('DFEDTARL')), hi = last(raw('DFEDTARU'));
    const pce = last(pct('PCEPI', 12)), core = last(pct('PCEPILFE', 12));
    const br = last(raw('BREADTH_12M')), ur = last(raw('UNRATE'));
    const tiles = [
      { label: 'Fed funds target range', value: lo && hi ? `${lo.v.toFixed(2)}–${hi.v.toFixed(2)}%` : '–', sub: hi ? `As of ${fmtDate(hi.d, 'D')}` : '' },
      { label: 'PCE inflation, 12-month', value: fmtVal(pce && pce.v, '%'), sub: pce ? `${fmtDate(pce.d, 'M')} · Jackson Hole: 3.7% · Target 2%` : '' },
      { label: 'Core PCE, 12-month', value: fmtVal(core && core.v, '%'), sub: core ? `${fmtDate(core.d, 'M')}` : '' },
      { label: 'PCE components above 3%', value: fmtVal(br && br.v, '%', 0), sub: br ? `${fmtDate(br.d, 'M')} · Jackson Hole: 54%` : '' },
      { label: 'Unemployment rate', value: fmtVal(ur && ur.v, '%'), sub: ur ? `${fmtDate(ur.d, 'M')} · Jackson Hole: 4.1%` : '' },
    ];
    el.innerHTML = tiles.map((t) => `<div class="tile"><p class="tile-label">${t.label}</p><p class="tile-value">${t.value}</p><p class="tile-sub">${t.sub}</p></div>`).join('');
  }

  // ------------------------------------------------------------------ release calendar
  // DATA.calendar: [{ id, name, series: [ids], dates: ['yyyy-mm-dd', ...] }] from FRED.
  // Dates already past (the data file can be a day or more old) are dropped here.
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const dayDiff = (a, b) => Math.round((toTime(b) - toTime(a)) / 864e5);
  const fmtDay = (d) => `${WEEKDAYS[new Date(toTime(d)).getUTCDay()]}, ${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;
  function fmtIn(d) {
    const k = dayDiff(todayStr, d);
    return k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : `In ${k} days`;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RELEASES = (DATA.calendar || []).map((r) => {
    const up = (r.dates || []).filter((d) => d >= todayStr);
    // Published every business day (Treasury yields, spreads, VIX, the dollar...).
    const daily = up.length >= 5 && dayDiff(up[0], up[4]) <= 8;
    return { ...r, up, daily };
  }).filter((r) => r.up.length);
  // Series ids a panel reads, taken from its getters, e.g. pct('PCEPI', 12) -> PCEPI.
  const panelIds = (panel) => [...new Set(panel.series.flatMap((s) => (s.get.toString().match(/'[A-Z0-9_]+'/g) || []).map((q) => q.slice(1, -1))))];
  const releasesFor = (panel) => RELEASES.filter((r) => r.series.some((id) => panel.ids.includes(id)));
  function nextUpdate(panel) {
    const rs = releasesFor(panel);
    if (!rs.length) return '';
    const scheduled = rs.filter((r) => !r.daily).sort((a, b) => (a.up[0] < b.up[0] ? -1 : 1));
    if (rs.some((r) => r.daily)) {
      // Daily lines dominate; still flag the next rate decision on the policy-rate chart.
      const fomc = scheduled.find((r) => /FOMC/i.test(r.name));
      return 'updates daily' + (fomc ? ` · FOMC ${fmtDay(fomc.up[0])}` : '');
    }
    if (!scheduled.length) return '';
    return `next data ${fmtDay(scheduled[0].up[0])}`;
  }

  function renderCalendar() {
    const host = document.getElementById('calendar');
    if (!RELEASES.length) { host.hidden = true; return; }
    const allPanels = SECTIONS.flatMap((s) => s.panels);
    const rows = RELEASES.filter((r) => !r.daily).sort((a, b) => (a.up[0] < b.up[0] ? -1 : a.up[0] > b.up[0] ? 1 : a.name.localeCompare(b.name)));
    const daily = RELEASES.filter((r) => r.daily);
    const SHOW = 6;
    const rowHtml = (r, i) => {
      const panels = allPanels.filter((p) => r.series.some((id) => p.ids.includes(id)));
      const fomc = /FOMC/i.test(r.name);
      return `<tr${i >= SHOW ? ' class="cal-more" hidden' : ''}${fomc ? ' data-fomc' : ''}>
        <td class="cal-date"><span class="cal-day">${fmtDay(r.up[0])}</span><span class="cal-in">${fmtIn(r.up[0])}</span></td>
        <td><a href="https://fred.stlouisfed.org/release?rid=${+r.id}">${esc(r.name)}</a>${fomc ? ' <span class="cal-tag">Rate decision</span>' : ''}</td>
        <td class="cal-panels">${panels.map((p) => `<a href="#${p.anchor}">${p.title}</a>`).join(', ')}</td>
        <td class="cal-then">${r.up[1] ? fmtDay(r.up[1]) : ''}</td></tr>`;
    };
    host.innerHTML = `
      <h2>Upcoming data releases</h2>
      <p class="section-note">When each source publishes next. Dates come from the FRED release calendar; the dashboard picks up new numbers in its next daily refresh.</p>
      <div class="cal-wrap"><table class="cal">
        <thead><tr><th>Next release</th><th>Release</th><th>Updates</th><th>After that</th></tr></thead>
        <tbody>${rows.map(rowHtml).join('')}</tbody>
      </table></div>
      ${rows.length > SHOW ? `<button type="button" class="ghost cal-toggle" aria-expanded="false">Show all ${rows.length} releases</button>` : ''}
      ${daily.length ? `<p class="cal-daily">Every business day: ${daily.map((r) => esc(r.name)).join(' · ')}</p>` : ''}`;
    const btn = host.querySelector('.cal-toggle');
    if (btn) btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      host.querySelectorAll('.cal-more').forEach((tr) => { tr.hidden = !open; });
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Show fewer' : `Show all ${rows.length} releases`;
    });
  }

  // ------------------------------------------------------------------ chart
  const tooltip = document.getElementById('tooltip');
  const SERIES_VARS = ['--series-1', '--series-2', '--series-3'];
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let rangeYears = 5;
  const charts = [];

  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag, step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return { ticks, lo, hi, step };
  }
  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVGNS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function nearestIdx(arr, t) {
    let lo = 0, hi = arr.length - 1;
    if (hi < 0) return -1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].t < t) lo = mid + 1; else hi = mid; }
    if (lo > 0 && Math.abs(arr[lo - 1].t - t) <= Math.abs(arr[lo].t - t)) lo--;
    return lo;
  }

  function buildCard(panel, container) {
    const card = document.createElement('article');
    card.className = 'card';
    const all = panel.series.map((s, i) => ({ ...s, color: SERIES_VARS[i], data: s.get() }));
    const unit = panel.unit, digits = panel.digits == null ? 1 : panel.digits;
    const head = all[0].data.length ? last(all[0].data) : null;
    const next = nextUpdate(panel);
    card.id = panel.anchor;
    card.innerHTML = `
      <div class="card-head"><h3>${panel.title}</h3><span class="card-latest">${head ? fmtVal(head.v, unit, digits) : '–'}</span></div>
      <p class="card-sub">${panel.sub}${head ? ` · latest ${fmtDate(head.d, all[0].freq || panel.freq)}` : ''}${next ? ` · <span class="card-next">${next}</span>` : ''}</p>
      ${panel.speech ? `<p class="speech">${panel.speech}</p>` : ''}
      ${all.length > 1 ? `<ul class="legend">${all.map((s) => `<li><span class="swatch" style="background:var(${s.color})"></span>${s.label}</li>`).join('')}</ul>` : ''}
      <div class="chart" tabindex="0" role="img" aria-label="${panel.title} chart. Use left and right arrow keys to read values."></div>
      <div class="card-foot"><details class="table-view"><summary>Data table</summary><div class="table-wrap"></div></details><span>${panel.source}</span></div>`;
    container.appendChild(card);
    const chart = { panel, all, unit, digits, root: card.querySelector('.chart'), tableWrap: card.querySelector('.table-wrap'), hoverIdx: null };
    charts.push(chart);
    attachHover(chart);
    card.querySelector('details').addEventListener('toggle', (e) => { if (e.target.open) renderTable(chart); });
  }

  function visible(chart) {
    const end = Math.max(...chart.all.map((s) => (s.data.length ? last(s.data).t : 0)));
    const start = end - rangeYears * 365.25 * 864e5;
    return { start, end, series: chart.all.map((s) => ({ ...s, vis: s.data.filter((o) => o.t >= start) })) };
  }

  function draw(chart) {
    const { root, panel, unit, digits } = chart;
    const W = Math.max(root.clientWidth, 280), H = 230;
    const m = { t: 10, r: 64, b: 24, l: 40 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const { start, end, series } = visible(chart);
    chart.view = { start, end, series, m, pw, ph, W, H };
    let vals = series.flatMap((s) => s.vis.map((o) => o.v));
    (panel.refs || []).forEach((r) => vals.push(r.y));
    if (panel.zero || panel.kind === 'bar') vals.push(0);
    if (!vals.length) vals = [0, 1];
    let min = Math.min(...vals), max = Math.max(...vals);
    const pad = (max - min) * 0.06 || 1;
    if (!(panel.zero && min >= 0)) min -= pad;
    max += pad;
    const yt = niceTicks(min, max, 4);
    const x = (t) => m.l + ((t - start) / (end - start || 1)) * pw;
    const y = (v) => m.t + ph - ((v - yt.lo) / (yt.hi - yt.lo)) * ph;
    chart.x = x; chart.y = y;

    root.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, root);
    // grid + y labels
    for (const v of yt.ticks) {
      const yy = Math.round(y(v)) + 0.5;
      el('line', { x1: m.l, x2: m.l + pw, y1: yy, y2: yy, stroke: v === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }, svg);
      const tx = el('text', { x: m.l - 6, y: yy + 3.5, 'text-anchor': 'end' }, svg);
      tx.textContent = fmtVal(v, unit === '%' || unit === 'pp' ? '' : unit, yt.step < 1 ? (yt.step < 0.1 ? 2 : 1) : 0) + (unit === '%' ? '%' : '');
    }
    // x ticks
    const months = (end - start) / (30.44 * 864e5);
    const stepM = months <= 30 ? 6 : months <= 72 ? 12 : 24;
    const s0 = new Date(start); let ty = s0.getUTCFullYear(), tm = Math.ceil(s0.getUTCMonth() / stepM) * stepM;
    if (stepM === 24 && ty % 2) { ty++; tm = 0; }
    for (;;) {
      const yy = ty + Math.floor(tm / 12), mm = tm % 12, t = Date.UTC(yy, mm, 1);
      if (t > end) break;
      if (t >= start) {
        const xx = Math.round(x(t)) + 0.5;
        el('line', { x1: xx, x2: xx, y1: m.t + ph, y2: m.t + ph + 4, stroke: 'var(--axis)' }, svg);
        const tx = el('text', { x: xx, y: H - 6, 'text-anchor': 'middle' }, svg);
        tx.textContent = stepM < 12 ? `${MONTHS[mm]} ${String(yy).slice(2)}` : String(yy);
      }
      tm += stepM;
    }
    el('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph + 0.5, y2: m.t + ph + 0.5, stroke: 'var(--axis)' }, svg);
    // reference lines
    for (const r of panel.refs || []) {
      const yy = Math.round(y(r.y)) + 0.5;
      el('line', { x1: m.l, x2: m.l + pw, y1: yy, y2: yy, stroke: 'var(--ref)', 'stroke-width': 1, 'stroke-dasharray': '4 3', opacity: 0.8 }, svg);
      const tx = el('text', { x: m.l + 4, y: yy - 4, class: 'ref-label' }, svg);
      tx.textContent = r.label;
    }
    // marks
    if (panel.kind === 'bar') {
      const s = series[0], n = s.vis.length || 1;
      const bw = Math.max(1, Math.min(10, pw / n - 2));
      const y0 = y(0);
      for (const o of s.vis) {
        const xx = x(o.t), yy = y(o.v), h = Math.abs(yy - y0);
        el('rect', { x: xx - bw / 2, y: Math.min(yy, y0), width: bw, height: Math.max(h, 0.5), rx: Math.min(2, bw / 2), fill: `var(${s.color})` }, svg);
      }
    } else {
      for (const s of series) {
        if (!s.vis.length) continue;
        const dpath = s.vis.map((o, i) => `${i ? 'L' : 'M'}${x(o.t).toFixed(1)},${y(o.v).toFixed(1)}`).join('');
        el('path', { d: dpath, fill: 'none', stroke: `var(${s.color})`, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      }
    }
    // end labels (direct labels at the latest point, nudged apart)
    const ends = series.filter((s) => s.vis.length).map((s) => { const o = last(s.vis); return { s, o, yy: y(o.v) }; })
      .sort((a, b) => a.yy - b.yy);
    for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 12) ends[i].yy = ends[i - 1].yy + 12;
    for (const e of ends) {
      if (panel.kind !== 'bar') el('circle', { cx: x(e.o.t), cy: y(e.o.v), r: 4, fill: `var(${e.s.color})`, stroke: 'var(--surface-1)', 'stroke-width': 2 }, svg);
      const tx = el('text', { x: m.l + pw + 8, y: e.yy + 4, class: 'end-label' }, svg);
      tx.textContent = fmtVal(e.o.v, unit, digits);
    }
    // hover layer
    chart.hoverG = el('g', { 'pointer-events': 'none' }, svg);
    chart.overlay = el('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' }, svg);
    if (chart.hoverIdx != null) showHover(chart, chart.hoverIdx);
  }

  function hoverRows(chart, t) {
    return chart.view.series.map((s) => {
      const i = nearestIdx(s.vis, t);
      return i < 0 ? null : { s, o: s.vis[i] };
    }).filter(Boolean);
  }
  function showHover(chart, idx) {
    const { series, m, ph } = chart.view, base = series[0].vis;
    if (!base.length) return;
    idx = Math.max(0, Math.min(base.length - 1, idx));
    chart.hoverIdx = idx;
    const t = base[idx].t, g = chart.hoverG;
    g.innerHTML = '';
    const xx = Math.round(chart.x(t)) + 0.5;
    el('line', { x1: xx, x2: xx, y1: m.t, y2: m.t + ph, stroke: 'var(--text-muted)', 'stroke-width': 1 }, g);
    const rows = hoverRows(chart, t);
    if (chart.panel.kind !== 'bar') for (const r of rows) el('circle', { cx: chart.x(r.o.t), cy: chart.y(r.o.v), r: 4, fill: `var(${r.s.color})`, stroke: 'var(--surface-1)', 'stroke-width': 2 }, g);
    const freq = chart.all[0].freq || chart.panel.freq;
    tooltip.innerHTML = `<div class="tt-date">${fmtDate(base[idx].d, freq === 'W' ? 'D' : freq)}</div>` + rows.map((r) =>
      `<div class="tt-row"><span class="tt-name"><span class="swatch" style="background:var(${r.s.color})"></span>${r.s.label}</span><span class="tt-val">${fmtVal(r.o.v, chart.unit, chart.digits)}</span></div>`).join('');
    tooltip.hidden = false;
    const box = chart.root.getBoundingClientRect(), svgScale = box.width / chart.view.W;
    let left = box.left + xx * svgScale + 14, top = box.top + m.t * svgScale;
    const tw = tooltip.offsetWidth;
    if (left + tw > window.innerWidth - 8) left = box.left + xx * svgScale - tw - 14;
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }
  function hideHover(chart) {
    chart.hoverIdx = null;
    if (chart.hoverG) chart.hoverG.innerHTML = '';
    tooltip.hidden = true;
  }
  function attachHover(chart) {
    const root = chart.root;
    const fromEvent = (e) => {
      const box = root.getBoundingClientRect(), scale = chart.view.W / box.width;
      const px = (e.clientX - box.left) * scale, { m, pw, start, end } = chart.view;
      const t = start + ((px - m.l) / pw) * (end - start);
      return nearestIdx(chart.view.series[0].vis, t);
    };
    root.addEventListener('pointermove', (e) => { if (chart.view) showHover(chart, fromEvent(e)); });
    root.addEventListener('pointerleave', () => hideHover(chart));
    root.addEventListener('blur', () => hideHover(chart));
    root.addEventListener('keydown', (e) => {
      if (!chart.view) return;
      const len = chart.view.series[0].vis.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = chart.hoverIdx == null ? len - 1 : chart.hoverIdx + (e.key === 'ArrowLeft' ? -1 : 1);
        showHover(chart, cur);
      } else if (e.key === 'Escape') hideHover(chart);
    });
  }

  function renderTable(chart) {
    const { series } = visible(chart);
    const freq = chart.all[0].freq || chart.panel.freq;
    const dates = [...new Set(series.flatMap((s) => s.vis.map((o) => o.d)))].sort().reverse();
    const maps = series.map((s) => new Map(s.vis.map((o) => [o.d, o.v])));
    chart.tableWrap.innerHTML = `<table><thead><tr><th>Date</th>${series.map((s) => `<th>${s.label}</th>`).join('')}</tr></thead><tbody>${
      dates.map((d) => `<tr><td>${fmtDate(d, freq === 'W' ? 'D' : freq)}</td>${maps.map((mp) => `<td>${mp.has(d) ? fmtVal(mp.get(d), chart.unit, chart.digits) : ''}</td>`).join('')}</tr>`).join('')
    }</tbody></table>`;
  }

  function redrawAll() {
    for (const c of charts) { draw(c); if (c.tableWrap.closest('details').open) renderTable(c); }
  }

  // ------------------------------------------------------------------ boot
  function render() {
    const host = document.getElementById('sections');
    SECTIONS.flatMap((s) => s.panels).forEach((p, i) => {
      p.ids = panelIds(p);
      p.anchor = 'panel-' + p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    });
    renderCalendar();
    for (const sec of SECTIONS) {
      const s = document.createElement('section');
      s.className = 'section';
      s.innerHTML = `<h2>${sec.title}</h2><p class="section-note">${sec.note}</p><div class="grid"></div>`;
      host.appendChild(s);
      const grid = s.querySelector('.grid');
      for (const p of sec.panels) buildCard(p, grid);
    }
    renderTiles();
    const gen = new Date(DATA.generated);
    document.getElementById('updated').textContent = `Data refreshed ${gen.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`;
    const nc = document.getElementById('n-components'); if (nc && DATA.breadth) nc.textContent = DATA.breadth.components;
    redrawAll();
    let raf = 0;
    new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(redrawAll); }).observe(host);
  }

  document.querySelectorAll('.seg').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    rangeYears = +b.dataset.range;
    redrawAll();
  }));

  const themeBtn = document.getElementById('theme-toggle');
  const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  function applyTheme(theme) {
    if (theme) document.documentElement.setAttribute('data-theme', theme); else document.documentElement.removeAttribute('data-theme');
    const dark = theme ? theme === 'dark' : prefersDark();
    themeBtn.textContent = dark ? 'Light mode' : 'Dark mode';
  }
  let saved = null;
  try { saved = localStorage.getItem('warsh-theme'); } catch (e) { /* storage unavailable */ }
  applyTheme(saved);
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || (prefersDark() ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('warsh-theme', next); } catch (e) { /* ignore */ }
    applyTheme(next);
  });

  render();
})();
