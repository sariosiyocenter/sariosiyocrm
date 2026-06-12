// tabs.jsx — Dynamic product preview. Four tabs cycle through high-fidelity
// mockups for Schedule, Finance, Leads (kanban) and Reports.

const PreviewTabs = ({ lang, t }) => {
  const tabs = t('preview.tabs');
  const [active, setActive] = React.useState(tabs[0].key);

  return (
    <div>
      {/* Tab pills */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <button key={tab.key} onClick={() => setActive(tab.key)}
              className={"inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all " +
                (on
                  ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white border-transparent shadow-[0_10px_40px_-15px_var(--accent)]"
                  : "glass text-[var(--text-dim)] hover:text-[var(--text)]")}>
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Frame */}
      <div className="glass-strong rounded-2xl overflow-hidden neon-ring"
           style={{ boxShadow: "0 40px 100px -40px rgba(0,0,0,0.6), 0 0 0 1px var(--border-strong)" }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></span>
          <div className="ml-4 px-3 py-1 rounded-md bg-[var(--surface-2)] text-[11px] text-[var(--text-faint)] font-mono">
            quantum.uz/{active}
          </div>
        </div>

        <div className="min-h-[520px] tab-enter" key={active}>
          {active === "schedule" && <ScheduleView lang={lang} />}
          {active === "finance"  && <FinanceView lang={lang} />}
          {active === "leads"    && <LeadsView lang={lang} />}
          {active === "reports"  && <ReportsView lang={lang} />}
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────── Schedule ──────────────────────── */
function ScheduleView({ lang }) {
  const days_uz = ["Du","Se","Ch","Pa","Ju","Sh","Ya"];
  const days_en = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const days = lang === 'en' ? days_en : days_uz;
  const hours = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

  const lessons = [
    { day: 0, h: 0,  span: 2, title: "IELTS B1", teacher: "Aliyev S.", room: "204", color: "#6366f1" },
    { day: 0, h: 4,  span: 2, title: "Math 9th",   teacher: "Karimova M.", room: "101", color: "#10b981" },
    { day: 1, h: 1,  span: 1.5, title: "Web dev", teacher: "Yusupov B.", room: "Lab 3", color: "#a855f7" },
    { day: 1, h: 5,  span: 2, title: "SAT prep",   teacher: "Tursunova S.", room: "204", color: "#ec4899" },
    { day: 2, h: 0,  span: 1.5, title: "IELTS B2", teacher: "Aliyev S.", room: "204", color: "#6366f1" },
    { day: 2, h: 3,  span: 2, title: "Python", teacher: "Yusupov B.", room: "Lab 3", color: "#a855f7" },
    { day: 3, h: 2,  span: 2, title: "TOEFL",     teacher: "Aliyev S.", room: "204", color: "#6366f1" },
    { day: 3, h: 5,  span: 1.5, title: "Math 11th", teacher: "Karimova M.", room: "101", color: "#10b981" },
    { day: 4, h: 1,  span: 2, title: "IELTS B1",   teacher: "Aliyev S.", room: "204", color: "#6366f1" },
    { day: 4, h: 5,  span: 2, title: "UI/UX",     teacher: "Saidova N.", room: "Lab 2", color: "#f59e0b" },
    { day: 5, h: 0,  span: 3, title: "Bootcamp", teacher: "Yusupov B.", room: "Lab 3", color: "#a855f7" },
  ];

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Schedule':'Dars jadvali'}</div>
          <div className="font-display font-bold text-xl">{lang==='en'?'Week 47 · Nov':"47-hafta · Noyabr"}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="chip"><Icon name="filter" size={13} />{lang==='en'?'All teachers':"Hamma o'qituvchilar"}</span>
          <span className="chip"><Icon name="building-2" size={13} />{lang==='en'?'Main branch':"Asosiy filial"}</span>
          <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white font-medium">
            <Icon name="plus" size={14} /> {lang==='en'?'New lesson':"Yangi dars"}
          </button>
        </div>
      </div>

      <div className="grid border border-[var(--border)] rounded-xl overflow-hidden text-[11px]"
           style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
        <div className="bg-[var(--surface)]"></div>
        {days.map((d, i) => (
          <div key={i} className="px-2 py-2 bg-[var(--surface)] border-l border-[var(--border)] text-center font-medium">
            {d} <span className="text-[var(--text-faint)] ml-0.5">{18 + i}</span>
          </div>
        ))}

        {hours.map((h, hi) => (
          <React.Fragment key={hi}>
            <div className="px-2 py-3 text-[var(--text-faint)] text-[10px] border-t border-[var(--border)] font-mono">{h}</div>
            {days.map((_, di) => (
              <div key={di} className="relative border-t border-l border-[var(--border)]" style={{ height: 38 }}>
                {lessons.filter(l => l.day === di && l.h === hi).map((l, i) => (
                  <div key={i} className="absolute left-1 right-1 rounded-md px-2 py-1.5 text-[10.5px] overflow-hidden cursor-pointer hover:opacity-90"
                       style={{
                         top: 2,
                         height: l.span * 38 - 4,
                         background: `linear-gradient(135deg, ${l.color}30, ${l.color}10)`,
                         borderLeft: `3px solid ${l.color}`,
                         color: 'var(--text)'
                       }}>
                    <div className="font-medium truncate">{l.title}</div>
                    <div className="text-[9.5px] text-[var(--text-dim)] truncate">{l.teacher} · {l.room}</div>
                  </div>
                ))}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-[var(--text-faint)] flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>{lang==='en'?'AI: 0 conflicts':"AI: 0 konflikt"}</span>
        <span>· 23 {lang==='en'?'lessons this week':"dars bu hafta"}</span>
        <span>· 87% {lang==='en'?'room utilization':"xona band"}</span>
      </div>
    </div>
  );
}

/* ──────────────────────── Finance ──────────────────────── */
function FinanceView({ lang }) {
  const months = lang === 'en'
    ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    : ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];
  const series = [62, 71, 68, 80, 88, 95, 102, 98, 112, 124, 138, 154];
  const max = Math.max(...series);

  const debts = [
    { name: "Karimov Bobur",     group: "IELTS B2",     due: "12 kun", amt: 850_000 },
    { name: "Saidova Nigora",    group: "Web dev",      due: "8 kun",  amt: 1_200_000 },
    { name: "Olimov Jasur",      group: "Math 9th",     due: "3 kun",  amt: 600_000 },
    { name: "Toirova Madina",    group: "SAT prep",     due: "1 kun",  amt: 1_500_000 },
    { name: "Mansurov Rustam",   group: "Python intro", due: "Bugun",  amt: 900_000 },
  ];

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Finance':"Moliya"}</div>
          <div className="font-display font-bold text-xl">{lang==='en'?"Cash flow":"Pul oqimi"}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="chip"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Click</span>
          <span className="chip"><span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span> Payme</span>
          <span className="chip"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Uzum</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <KPIBig label={lang==='en'?'Revenue YTD':"Yillik daromad"} val="1.84B" unit="UZS" delta="+18.4%" />
        <KPIBig label={lang==='en'?'Collected':"Yig'ildi"} val="92.7%" delta="+2.1pp" />
        <KPIBig label={lang==='en'?'Debtors':"Qarzdorlar"} val="34" unit={lang==='en'?'students':"o'quvchi"} delta="−6" trend="up" inverse />
        <KPIBig label={lang==='en'?'Avg check':"O'rtacha"} val="980K" unit="UZS" delta="+4.2%" />
      </div>

      <div className="grid grid-cols-[1.6fr,1fr] gap-3">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] text-[var(--text-faint)]">{lang==='en'?'Revenue by month':"Oylar bo'yicha daromad"}</div>
              <div className="text-sm text-emerald-400">+24.6% YoY</div>
            </div>
            <div className="font-mono text-[10px] text-[var(--text-faint)]">{lang==='en'?'in millions UZS':"mln so'm"}</div>
          </div>
          <div className="flex items-end gap-2 h-44">
            {series.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-md relative overflow-hidden"
                     style={{
                       height: `${(v/max)*100}%`,
                       background: i === series.length - 1
                         ? "linear-gradient(180deg, var(--accent-2), var(--accent))"
                         : "linear-gradient(180deg, color-mix(in oklab, var(--accent) 70%, transparent), color-mix(in oklab, var(--accent) 30%, transparent))",
                       transform: 'scaleY(1)',
                       transformOrigin: 'bottom',
                       animation: `bar-grow .6s ${i*0.05}s ease-out backwards`,
                     }}>
                </div>
                <div className="text-[9.5px] text-[var(--text-faint)] font-mono">{months[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-[var(--text-faint)]">{lang==='en'?'Debtors — next 14 days':"Qarzdorlar — 14 kun"}</div>
            <span className="text-[10px] text-amber-400">5 / 34</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {debts.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[10px] text-[var(--text-dim)]">{d.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{d.name}</div>
                  <div className="text-[var(--text-faint)] text-[10px] truncate">{d.group}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono">{fmt(d.amt)}</div>
                  <div className={"text-[9.5px] " + (d.due === "Bugun" || d.due === "1 kun" ? "text-rose-400" : "text-[var(--text-faint)]")}>{d.due}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-3 w-full py-2 rounded-lg bg-[var(--surface-2)] text-[11px] hover:bg-[var(--surface)] border border-[var(--border)]">
            {lang==='en'?'Send SMS reminder':"SMS eslatma yuborish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function KPIBig({ label, val, unit, delta, inverse }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[11px] text-[var(--text-faint)]">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <div className="font-display font-bold text-[22px] tabular-nums">{val}</div>
        {unit && <div className="text-[10.5px] text-[var(--text-faint)]">{unit}</div>}
      </div>
      <div className="text-[10.5px] mt-0.5 text-emerald-400">{delta}</div>
    </div>
  );
}

/* ──────────────────────── Leads ──────────────────────── */
function LeadsView({ lang }) {
  const cols_uz = [
    { k: "Yangi",     n: 18, c: "#6366f1", leads: [
      { name: "Aziza R.",    src: "Instagram", course: "IELTS B1",  age: "2 soat" },
      { name: "Bekhzod T.",  src: "Sayt",      course: "Web dev",   age: "5 soat" },
      { name: "Munisa K.",   src: "Telegram",  course: "SAT prep",  age: "Bugun" },
    ]},
    { k: "Aloqa",     n: 12, c: "#8b5cf6", leads: [
      { name: "Sherzod M.",  src: "Qo'ng'iroq", course: "TOEFL",     age: "1 kun" },
      { name: "Dilnoza A.",  src: "Sayt",       course: "Bootcamp",  age: "2 kun" },
    ]},
    { k: "Sinov darsi", n: 9, c: "#ec4899", leads: [
      { name: "Olim S.",     src: "Tavsiya",   course: "Math 11th",  age: "3 kun" },
      { name: "Nigora I.",   src: "Sayt",      course: "UI/UX",      age: "3 kun" },
      { name: "Akmal H.",    src: "Instagram", course: "Python",     age: "4 kun" },
    ]},
    { k: "Muzokara",  n: 5, c: "#f59e0b", leads: [
      { name: "Sevinch U.",  src: "Telegram", course: "IELTS B2",   age: "1 hafta" },
    ]},
    { k: "Yopildi",   n: 24, c: "#10b981", leads: [
      { name: "Jasur K.",    src: "Sayt",     course: "Web dev",    age: "Bugun", won: true },
      { name: "Mavluda S.",  src: "Tavsiya", course: "IELTS B1",   age: "Kecha", won: true },
    ]},
  ];
  const cols_en = [
    { k: "New",     n: 18, c: "#6366f1", leads: [
      { name: "Aziza R.",   src: "Instagram", course: "IELTS B1",  age: "2h" },
      { name: "Bekhzod T.", src: "Site",      course: "Web dev",   age: "5h" },
      { name: "Munisa K.",  src: "Telegram",  course: "SAT prep",  age: "today" },
    ]},
    { k: "Contacted", n: 12, c: "#8b5cf6", leads: [
      { name: "Sherzod M.", src: "Phone",     course: "TOEFL",     age: "1d" },
      { name: "Dilnoza A.", src: "Site",      course: "Bootcamp",  age: "2d" },
    ]},
    { k: "Trial",    n: 9, c: "#ec4899", leads: [
      { name: "Olim S.",    src: "Referral",  course: "Math 11th", age: "3d" },
      { name: "Nigora I.",  src: "Site",      course: "UI/UX",     age: "3d" },
      { name: "Akmal H.",   src: "Instagram", course: "Python",    age: "4d" },
    ]},
    { k: "Negotiation", n: 5, c: "#f59e0b", leads: [
      { name: "Sevinch U.", src: "Telegram", course: "IELTS B2",   age: "1w" },
    ]},
    { k: "Won",      n: 24, c: "#10b981", leads: [
      { name: "Jasur K.",   src: "Site",     course: "Web dev",    age: "today", won: true },
      { name: "Mavluda S.", src: "Referral", course: "IELTS B1",   age: "yesterday", won: true },
    ]},
  ];
  const cols = lang === 'en' ? cols_en : cols_uz;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Pipeline':"Voronka"}</div>
          <div className="font-display font-bold text-xl">{lang==='en'?'68 leads in pipeline':"Voronkada 68 lid"}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="chip"><Icon name="instagram" size={13} /> 24</span>
          <span className="chip"><Icon name="globe" size={13} /> 18</span>
          <span className="chip"><Icon name="send" size={13} /> 14</span>
          <span className="chip"><Icon name="phone" size={13} /> 12</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        {cols.map((c) => (
          <div key={c.k} className="glass rounded-xl p-2.5 min-h-[380px]">
            <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: c.c }}></span>
                <span className="text-[11px] font-medium">{c.k}</span>
              </div>
              <span className="text-[10px] text-[var(--text-faint)] font-mono">{c.n}</span>
            </div>
            <div className="flex flex-col gap-2">
              {c.leads.map((l, i) => (
                <div key={i} className="rounded-lg p-2 bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer">
                  <div className="text-[11px] font-medium truncate">{l.name}</div>
                  <div className="text-[10px] text-[var(--text-faint)] truncate mt-0.5">{l.course}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-dim)]">{l.src}</span>
                    <span className="text-[9.5px] text-[var(--text-faint)] font-mono">{l.age}</span>
                  </div>
                  {l.won && (
                    <div className="mt-1.5 text-[9.5px] text-emerald-400 flex items-center gap-1">
                      <Icon name="check-circle-2" size={11} /> {lang==='en'?'enrolled':"ro'yxatda"}
                    </div>
                  )}
                </div>
              ))}
              <button className="rounded-lg py-1.5 text-[10px] text-[var(--text-faint)] border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)]">
                + {lang==='en'?'Add lead':"Lid qo'shish"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────── Reports ──────────────────────── */
function ReportsView({ lang }) {
  const months_uz = ["Iyn","Iyl","Avg","Sen","Okt","Noy"];
  const months_en = ["Jun","Jul","Aug","Sep","Oct","Nov"];
  const months = lang === 'en' ? months_en : months_uz;

  // Cohort retention matrix
  const cohorts = [
    [100, 92, 88, 84, 82, 80],
    [100, 94, 90, 87, 85, null],
    [100, 91, 88, 85, null, null],
    [100, 95, 92, null, null, null],
    [100, 96, null, null, null, null],
    [100, null, null, null, null, null],
  ];

  const sources_uz = [
    { name: "Instagram", v: 38, color: "#ec4899" },
    { name: "Sayt", v: 24, color: "#6366f1" },
    { name: "Tavsiya", v: 18, color: "#10b981" },
    { name: "Telegram", v: 14, color: "#a855f7" },
    { name: "Boshqa", v: 6, color: "#64748b" },
  ];
  const sources_en = [
    { name: "Instagram", v: 38, color: "#ec4899" },
    { name: "Website", v: 24, color: "#6366f1" },
    { name: "Referral", v: 18, color: "#10b981" },
    { name: "Telegram", v: 14, color: "#a855f7" },
    { name: "Other", v: 6, color: "#64748b" },
  ];
  const sources = lang === 'en' ? sources_en : sources_uz;

  // Donut
  let cum = 0;
  const total = sources.reduce((a, b) => a + b.v, 0);
  const segs = sources.map((s) => {
    const start = cum / total;
    cum += s.v;
    const end = cum / total;
    return { ...s, start, end };
  });

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Reports':"Hisobotlar"}</div>
          <div className="font-display font-bold text-xl">{lang==='en'?'Retention & acquisition':"Retention va lidlar"}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="chip"><Icon name="calendar" size={13} /> {lang==='en'?'Last 6 months':"6 oy"}</span>
          <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-[var(--surface-2)] border border-[var(--border)]">
            <Icon name="download" size={14} /> Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1.6fr,1fr] gap-3">
        {/* Cohort heatmap */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] text-[var(--text-faint)]">{lang==='en'?'Cohort retention':"Kogorta retention"}</div>
              <div className="text-sm text-emerald-400">{lang==='en'?'Avg 6-mo: 80%':"O'rtacha 6 oy: 80%"}</div>
            </div>
          </div>
          <div className="grid gap-1 text-[10px]" style={{ gridTemplateColumns: "80px repeat(6, 1fr)" }}>
            <div></div>
            {months.map((m) => <div key={m} className="text-center text-[var(--text-faint)] font-mono">M+{months.indexOf(m)}</div>)}
            {cohorts.map((row, ci) => (
              <React.Fragment key={ci}>
                <div className="text-[var(--text-faint)] font-mono pr-2 truncate">{months[ci]} '26</div>
                {row.map((v, vi) => {
                  if (v === null) return <div key={vi} className="rounded-md bg-[var(--surface)] h-9"></div>;
                  const intensity = v / 100;
                  return (
                    <div key={vi} className="rounded-md flex items-center justify-center h-9 font-mono"
                         style={{
                           background: `color-mix(in oklab, var(--accent) ${intensity*65}%, transparent)`,
                           color: intensity > 0.85 ? '#fff' : 'var(--text-dim)',
                         }}>{v}%</div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--text-faint)]">
            <span>0%</span>
            <div className="h-1.5 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, transparent, var(--accent))" }}></div>
            <span>100%</span>
          </div>
        </div>

        {/* Acquisition donut */}
        <div className="glass rounded-xl p-4">
          <div className="text-[11px] text-[var(--text-faint)] mb-2">{lang==='en'?'Lead sources':"Lid manbalari"}</div>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 100 100" width="120" height="120">
              {segs.map((s, i) => {
                const a0 = s.start * 2 * Math.PI - Math.PI/2;
                const a1 = s.end * 2 * Math.PI - Math.PI/2;
                const large = s.end - s.start > 0.5 ? 1 : 0;
                const r = 38;
                const x0 = 50 + r * Math.cos(a0), y0 = 50 + r * Math.sin(a0);
                const x1 = 50 + r * Math.cos(a1), y1 = 50 + r * Math.sin(a1);
                return <path key={i} d={`M 50 50 L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`} fill={s.color} />;
              })}
              <circle cx="50" cy="50" r="22" fill="var(--bg)" />
              <text x="50" y="48" textAnchor="middle" fontSize="11" fill="var(--text)" fontWeight="600">{total}</text>
              <text x="50" y="60" textAnchor="middle" fontSize="6" fill="var(--text-faint)">{lang==='en'?'leads':"lid"}</text>
            </svg>
            <div className="flex-1 flex flex-col gap-1.5">
              {sources.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-[11px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }}></span>
                  <span className="flex-1 text-[var(--text-dim)]">{s.name}</span>
                  <span className="font-mono">{s.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-[var(--text-faint)]">CAC</div>
              <div className="font-display font-bold text-lg">42K <span className="text-[10px] text-[var(--text-faint)]">UZS</span></div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-faint)]">LTV</div>
              <div className="font-display font-bold text-lg">1.8M <span className="text-[10px] text-[var(--text-faint)]">UZS</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PreviewTabs });
