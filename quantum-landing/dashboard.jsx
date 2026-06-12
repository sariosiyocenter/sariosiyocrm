// dashboard.jsx — Animated dashboard mockup that lives under the hero.
// Renders inside a faux browser frame with sidebar, KPIs, area chart, leads
// pipeline preview and a transactions feed — with live-incrementing numbers
// and a sparkle on the chart.

const { useState, useEffect, useRef, useMemo } = React;

// Lucide icon helper — Lucide ships a UMD object on `window.lucide`; we wrap it
// in a thin React component that emits the SVG via dangerouslySetInnerHTML
// because the UMD doesn't expose React components.
function Icon({ name, className = "", size = 18, strokeWidth = 1.75 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.lucide) return;
    const fn = window.lucide.icons?.[toPascal(name)] || window.lucide.icons?.[name];
    if (!fn) return;
    // lucide.icons.X is an array tuple in some versions; use createIcons via attr.
    ref.current.setAttribute('data-lucide', name);
    window.lucide.createIcons({ icons: window.lucide.icons, attrs: { 'stroke-width': strokeWidth, width: size, height: size }, nameAttr: 'data-lucide' });
  }, [name, size, strokeWidth]);
  return <i ref={ref} className={"inline-flex items-center justify-center " + className} style={{ width: size, height: size }} data-lucide={name} />;
}
function toPascal(s) {
  return s.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('');
}

// Tick a number toward a target so headline KPIs feel "live."
function useTicker(target, period = 2400) {
  const [v, setV] = useState(target);
  useEffect(() => {
    const id = setInterval(() => {
      setV((cur) => {
        // small random walk around target
        const delta = (Math.random() - 0.4) * Math.max(1, target * 0.012);
        return Math.max(0, Math.round(cur + delta));
      });
    }, period);
    return () => clearInterval(id);
  }, [target, period]);
  return v;
}

function fmt(n) { return n.toLocaleString('ru-RU').replace(/,/g, ' '); }

// Inline sparkline / area chart
function AreaChart({ data, color = "var(--accent)", color2 = "var(--accent-2)", height = 120 }) {
  const w = 520, h = height;
  const max = Math.max(...data) * 1.15;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - (v / max) * (h - 20) - 10]);
  const linePath = pts.reduce((acc, [x, y], i) => acc + (i === 0 ? `M ${x},${y}` : ` L ${x},${y}`), '');
  const areaPath = linePath + ` L ${w},${h} L 0,${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      {/* grid */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1="0" x2={w} y1={h * t} y2={h * t} stroke="var(--border)" strokeDasharray="2 4" />
      ))}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="5" fill="var(--bg)" stroke={color2} strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="9" fill="none" stroke={color2} strokeOpacity="0.4" className="pulse-soft" />
    </svg>
  );
}

// Sidebar nav item
function SBItem({ icon, label, active }) {
  return (
    <div className={"flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] " +
      (active ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-faint)]")}>
      <Icon name={icon} size={15} />
      <span>{label}</span>
    </div>
  );
}

function DashboardMockup({ lang }) {
  const labels_uz = {
    title: "Quantum • Demo markazi",
    overview: "Umumiy", schedule: "Jadval", students: "O'quvchilar",
    leads: "Lidlar", finance: "Moliya", omr: "OMR", reports: "Hisobotlar",
    revenue: "Bu oy daromad", active: "Faol o'quvchilar", retention: "Retention",
    todayLessons: "Bugungi darslar",
    newLeads: "Yangi lidlar", payments: "So'nggi to'lovlar",
    sum: "so'm", paid: "to'langan", pending: "kutilmoqda",
    weekFlow: "Haftalik o'sish", growth: "+24.6% o'tgan haftaga nisbatan",
  };
  const labels_en = {
    title: "Quantum • Demo center",
    overview: "Overview", schedule: "Schedule", students: "Students",
    leads: "Leads", finance: "Finance", omr: "OMR", reports: "Reports",
    revenue: "Revenue this month", active: "Active students", retention: "Retention",
    todayLessons: "Today's lessons",
    newLeads: "New leads", payments: "Recent payments",
    sum: "UZS", paid: "paid", pending: "pending",
    weekFlow: "Weekly growth", growth: "+24.6% vs last week",
  };
  const L = lang === 'en' ? labels_en : labels_uz;

  const revenue = useTicker(184_650_000, 2200);
  const active = useTicker(2847, 2600);
  const retention = useTicker(94, 3200);

  // Animated chart series — points cycle slightly to feel live
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => p + 1), 1800);
    return () => clearInterval(id);
  }, []);
  const series = useMemo(() => {
    const base = [42, 51, 49, 58, 64, 60, 72, 78, 74, 83, 88, 96];
    return base.map((v, i) => v + Math.sin((phase + i) * 0.6) * 3);
  }, [phase]);

  // Pipeline stages
  const stages = lang === 'en'
    ? [{ k: "New", n: 18, c: "#6366f1" }, { k: "Trial", n: 11, c: "#a855f7" }, { k: "Negotiation", n: 7, c: "#ec4899" }, { k: "Won", n: 24, c: "#10b981" }]
    : [{ k: "Yangi", n: 18, c: "#6366f1" }, { k: "Sinov", n: 11, c: "#a855f7" }, { k: "Muzokara", n: 7, c: "#ec4899" }, { k: "Yopildi", n: 24, c: "#10b981" }];

  const payments = [
    { name: "Aliyev Sardor",   group: "IELTS B1 · Tue/Thu", amt: 850_000, ok: true },
    { name: "Karimova Malika", group: "Web dev · Mo/We/Fr", amt: 1_200_000, ok: true },
    { name: "Yusupov Bekzod",  group: "Math 9th",            amt: 600_000,   ok: false },
    { name: "Tursunova Sevinch", group: "SAT prep",          amt: 1_500_000, ok: true },
  ];

  return (
    <div className="glass-strong rounded-2xl overflow-hidden neon-ring relative"
         style={{ boxShadow: "0 30px 80px -30px rgba(0,0,0,0.6), 0 0 0 1px var(--border-strong)" }}>
      {/* faux browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></span>
        <div className="ml-4 px-3 py-1 rounded-md bg-[var(--surface-2)] text-[11px] text-[var(--text-faint)] font-mono">
          quantum.uz/dashboard
        </div>
        <div className="ml-auto flex items-center gap-2 text-[var(--text-faint)]">
          <Icon name="bell" size={14} />
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)]"></span>
        </div>
      </div>

      <div className="grid grid-cols-[180px,1fr] min-h-[500px]">
        {/* sidebar */}
        <aside className="border-r border-[var(--border)] p-3 flex flex-col gap-1 bg-[var(--surface)]">
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center">
              <Icon name="atom" size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-[13px]">Quantum</span>
          </div>
          <SBItem icon="layout-dashboard" label={L.overview} active />
          <SBItem icon="calendar-range" label={L.schedule} />
          <SBItem icon="graduation-cap" label={L.students} />
          <SBItem icon="git-branch" label={L.leads} />
          <SBItem icon="wallet" label={L.finance} />
          <SBItem icon="scan-line" label={L.omr} />
          <SBItem icon="bar-chart-3" label={L.reports} />
          <div className="mt-auto p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[10.5px] text-[var(--text-faint)]">
            <div className="font-medium text-[var(--text-dim)] mb-0.5">{lang==='en'?'Trial':'Sinov'}: 11 / 14</div>
            <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]" style={{ width: '78%' }} />
            </div>
          </div>
        </aside>

        {/* main */}
        <main className="p-4 flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{L.title}</div>
              <div className="font-display font-bold text-lg">{L.overview}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="chip text-[10.5px]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft"></span> Live</span>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            <KPI label={L.revenue} value={fmt(revenue)} unit={L.sum} delta="+12.4%" trend="up" />
            <KPI label={L.active} value={fmt(active)} delta="+86" trend="up" />
            <KPI label={L.retention} value={retention + "%"} delta="+3.2pp" trend="up" />
          </div>

          {/* Chart + pipeline */}
          <div className="grid grid-cols-[1.4fr,1fr] gap-3">
            <div className="glass rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-[11px] text-[var(--text-faint)]">{L.weekFlow}</div>
                  <div className="text-[12px] text-emerald-400 font-medium">{L.growth}</div>
                </div>
                <div className="flex gap-1">
                  {["7D","30D","90D"].map((t,i) => (
                    <span key={t} className={"px-2 py-0.5 rounded-md text-[10px] " + (i===1 ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-faint)]")}>{t}</span>
                  ))}
                </div>
              </div>
              <AreaChart data={series} />
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-[11px] text-[var(--text-faint)] mb-2">{L.newLeads}</div>
              <div className="flex flex-col gap-2">
                {stages.map((s) => (
                  <div key={s.k} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.c }}></span>
                    <span className="text-[11.5px] text-[var(--text-dim)] flex-1">{s.k}</span>
                    <span className="font-mono text-[11.5px]">{s.n}</span>
                    <div className="w-16 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                      <div className="h-full" style={{ width: `${(s.n/24)*100}%`, background: s.c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payments feed */}
          <div className="glass rounded-xl">
            <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
              <div className="text-[11px] text-[var(--text-faint)]">{L.payments}</div>
              <span className="text-[10px] text-[var(--text-faint)]">{lang==='en'?'Auto-reconciled':'Avtomatik tasdiqlangan'}</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {payments.map((p, i) => (
                <div key={i} className="px-3 py-2 flex items-center gap-3 text-[11.5px]">
                  <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[10px] font-medium text-[var(--text-dim)]">
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{p.name}</div>
                    <div className="text-[var(--text-faint)] truncate text-[10.5px]">{p.group}</div>
                  </div>
                  <div className="font-mono">{fmt(p.amt)} <span className="text-[var(--text-faint)] text-[10px]">{L.sum}</span></div>
                  <span className={"px-2 py-0.5 rounded-md text-[10px] " +
                    (p.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400")}>
                    {p.ok ? L.paid : L.pending}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* floating notification */}
      <div className="absolute -right-4 top-32 hidden md:flex glass-strong rounded-xl p-3 gap-3 items-center float-y"
           style={{ boxShadow: "0 20px 50px -20px rgba(0,0,0,0.5)" }}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
          <Icon name="check" size={16} className="text-white" />
        </div>
        <div>
          <div className="text-[11px] font-medium">{lang==='en'?'Payment received':'To\'lov qabul qilindi'}</div>
          <div className="text-[10px] text-[var(--text-faint)]">+ 1 200 000 {L.sum} · Click</div>
        </div>
      </div>

      <div className="absolute -left-6 bottom-24 hidden md:flex glass-strong rounded-xl p-3 gap-3 items-center float-y"
           style={{ animationDelay: '1.5s', boxShadow: "0 20px 50px -20px rgba(0,0,0,0.5)" }}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center">
          <Icon name="sparkles" size={16} className="text-white" />
        </div>
        <div>
          <div className="text-[11px] font-medium">{lang==='en'?'OMR scanned · 42 sheets':'OMR skanerlandi · 42 varaq'}</div>
          <div className="text-[10px] text-[var(--text-faint)]">{lang==='en'?'Avg score 84%':'O\'rtacha 84%'}</div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, unit, delta, trend }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[11px] text-[var(--text-faint)]">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <div className="font-display font-bold text-[20px] tabular-nums">{value}</div>
        {unit && <div className="text-[10.5px] text-[var(--text-faint)]">{unit}</div>}
      </div>
      <div className={"text-[10.5px] mt-0.5 flex items-center gap-1 " + (trend === 'up' ? 'text-emerald-400' : 'text-rose-400')}>
        <span style={{ transform: trend === 'up' ? 'none' : 'rotate(180deg)', display: 'inline-block' }}>↑</span>
        {delta}
      </div>
    </div>
  );
}

Object.assign(window, { DashboardMockup, Icon, fmt });
