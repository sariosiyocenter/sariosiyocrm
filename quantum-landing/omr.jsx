// omr.jsx — OMR scanner animation. Renders a phone tilted over a test sheet,
// a scan line sweeping the sheet, bubbles filling in, and a results panel
// streaming names as the scan completes. Loops on a 8-second cycle.

function OMRDemo({ lang, t }) {
  // Loop phase: 0..3 (point camera → scanning → results → reset)
  const [phase, setPhase] = React.useState(0);

  React.useEffect(() => {
    // 0 -> 1 after 1.4s (start scan)
    // 1 -> 2 after 2.6s (show results)
    // 2 -> 0 after 3.4s (reset)
    const t0 = setTimeout(() => setPhase(1), 1400);
    const t1 = setTimeout(() => setPhase(2), 4000);
    const t2 = setTimeout(() => setPhase(0), 7400);
    const id = setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 7400);
    // initial chain
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearInterval(id); };
  }, []);

  // Answer key + sample student answers
  const questions = 20;
  const correct = ["A","C","B","D","A","B","C","A","D","B","A","C","D","B","A","C","B","D","A","C"];
  const student = ["A","C","B","D","A","B","C","B","D","B","A","C","D","A","A","C","B","D","A","C"];
  const score = student.filter((a, i) => a === correct[i]).length;

  const students = [
    { name: "Aliyev Sardor",     score: 19, rank: 1 },
    { name: "Karimova Malika",   score: 18, rank: 2 },
    { name: "Yusupov Bekzod",    score: 17, rank: 3 },
    { name: "Tursunova Sevinch", score: 17, rank: 4 },
    { name: "Olimov Jasur",      score: 16, rank: 5 },
    { name: "Saidova Nigora",    score: 15, rank: 6 },
  ];

  return (
    <div className="grid lg:grid-cols-[1.1fr,1fr] gap-6 items-stretch">
      {/* Phone + sheet stage */}
      <div className="relative glass-strong rounded-2xl p-8 overflow-hidden min-h-[500px] flex items-center justify-center neon-ring">
        {/* faint grid */}
        <div className="absolute inset-0 opacity-30"
             style={{
               backgroundImage: "radial-gradient(circle at 1px 1px, var(--border-strong) 1px, transparent 1px)",
               backgroundSize: "16px 16px",
             }}></div>

        {/* Test sheet */}
        <div className="relative" style={{ width: 280, perspective: "1200px" }}>
          <div className="relative bg-[#f8f6f0] dark:bg-[#f5f1e6] rounded-lg shadow-2xl"
               style={{
                 transform: "rotateX(8deg) rotateY(-6deg) rotateZ(-3deg)",
                 transformStyle: "preserve-3d",
                 padding: "20px 22px",
                 boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.08)",
                 color: "#1a1a1a",
               }}>
            {/* corner markers */}
            <span className="absolute top-2 left-2 w-3 h-3 bg-black"></span>
            <span className="absolute top-2 right-2 w-3 h-3 bg-black"></span>
            <span className="absolute bottom-2 left-2 w-3 h-3 bg-black"></span>
            <span className="absolute bottom-2 right-2 w-3 h-3 bg-black"></span>

            <div className="text-center mb-2">
              <div className="text-[9px] font-bold tracking-widest text-black/60">QUANTUM · OMR</div>
              <div className="text-[10px] font-bold">{lang==='en'?'TEST SHEET · 20 questions':"TEST VARAQA · 20 savol"}</div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
              {Array.from({ length: questions }).map((_, i) => {
                const filled = phase >= 1 && i < (phase === 1 ? Math.min(questions, 20) : questions);
                const matched = student[i] === correct[i];
                return (
                  <div key={i} className="flex items-center gap-1.5 text-[9px]">
                    <span className="w-3 text-right font-bold text-black/70">{i+1}.</span>
                    {["A","B","C","D"].map((opt) => {
                      const isStudent = student[i] === opt;
                      const show = phase >= 1 && isStudent;
                      const showResult = phase >= 2;
                      let bg = "transparent", border = "rgba(0,0,0,0.5)";
                      if (show && !showResult) { bg = "#1a1a1a"; border = "#1a1a1a"; }
                      if (show && showResult && matched) { bg = "#10b981"; border = "#10b981"; }
                      if (show && showResult && !matched) { bg = "#ef4444"; border = "#ef4444"; }
                      return (
                        <span key={opt} className="inline-flex items-center justify-center font-bold"
                              style={{
                                width: 10, height: 10, borderRadius: "50%",
                                border: `1px solid ${border}`, background: bg,
                                color: bg === "transparent" ? "rgba(0,0,0,0.5)" : "#fff",
                                fontSize: 6, transition: "all .25s",
                              }}>{opt}</span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scan line — only during phase 1 */}
          {phase === 1 && (
            <div className="absolute left-0 right-0 pointer-events-none"
                 style={{
                   top: 0, bottom: 0,
                   transform: "rotateX(8deg) rotateY(-6deg) rotateZ(-3deg)",
                 }}>
              <div className="absolute left-0 right-0 h-12"
                   style={{
                     background: "linear-gradient(180deg, transparent, var(--accent) 40%, var(--accent-2) 60%, transparent)",
                     filter: "blur(2px)",
                     opacity: 0.85,
                     animation: "omr-scan 2.4s ease-in-out infinite",
                   }}></div>
            </div>
          )}
        </div>

        {/* Phone overlay */}
        <div className="absolute top-6 right-6 lg:top-10 lg:right-10 w-32 lg:w-40 rounded-[26px] p-2"
             style={{
               background: "linear-gradient(160deg, #1a1d28, #0a0c14)",
               border: "1.5px solid rgba(255,255,255,0.1)",
               boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
             }}>
          <div className="rounded-[20px] overflow-hidden relative" style={{ aspectRatio: "9/16", background: "#000" }}>
            {/* notch */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-2.5 rounded-full bg-black z-10"></div>
            {/* camera preview */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b]"></div>
            {/* viewfinder corners */}
            {[
              "top-4 left-4 border-l-2 border-t-2",
              "top-4 right-4 border-r-2 border-t-2",
              "bottom-12 left-4 border-l-2 border-b-2",
              "bottom-12 right-4 border-r-2 border-b-2",
            ].map((c, i) => (
              <span key={i} className={"absolute w-4 h-4 " + c}
                    style={{ borderColor: phase >= 1 ? "var(--accent-2)" : "var(--accent)", transition: 'border-color .3s' }}></span>
            ))}
            {/* live count */}
            <div className="absolute top-6 right-3 px-1.5 py-0.5 rounded-md bg-black/50 text-white text-[7px] font-mono backdrop-blur-sm">
              {phase >= 2 ? "20 / 20" : phase === 1 ? "scan..." : "live"}
            </div>
            {/* status pill */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-[8px] font-medium whitespace-nowrap"
                 style={{
                   background: phase >= 2 ? "rgba(16,185,129,0.25)" : phase >= 1 ? "rgba(168,85,247,0.25)" : "rgba(99,102,241,0.25)",
                   color: phase >= 2 ? "#34d399" : phase >= 1 ? "#c4b5fd" : "#a5b4fc",
                   border: "1px solid currentColor",
                 }}>
              {phase >= 2 ? (lang==='en'?'✓ Done':"✓ Tayyor") : phase >= 1 ? (lang==='en'?'Scanning…':"Skanerlanmoqda…") : (lang==='en'?'Aim at sheet':"Varaqaga tuting")}
            </div>
            {/* AI scan overlay */}
            {phase === 1 && (
              <div className="absolute inset-x-3 inset-y-8 rounded-md pointer-events-none"
                   style={{
                     background: "linear-gradient(180deg, transparent, rgba(168,85,247,0.4), transparent)",
                     animation: "omr-scan 2.4s ease-in-out infinite",
                   }}></div>
            )}
          </div>
        </div>

        {/* Step indicator */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-2">
          {[0, 1, 2].map((i) => {
            const labels = [t('omr.step1'), t('omr.step2'), t('omr.step3')];
            const on = phase === i;
            return (
              <div key={i} className={"flex-1 rounded-lg px-2.5 py-2 text-[10.5px] glass " + (on ? "border-[var(--accent)] text-[var(--text)]" : "text-[var(--text-faint)]")}
                   style={{ borderColor: on ? 'var(--accent)' : 'var(--border)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono">0{i+1}</span>
                  <span className="truncate">{labels[i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Results panel */}
      <div className="glass-strong rounded-2xl p-5 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{lang==='en'?'Live results':"Jonli natijalar"}</div>
            <div className="font-display font-bold text-lg">{lang==='en'?'IELTS Mock · Group 204':"IELTS Mock · 204-guruh"}</div>
          </div>
          <span className="chip">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft"></span>
            {lang==='en'?'AI grading':"AI baholash"}
          </span>
        </div>

        {/* Score callout */}
        <div className="rounded-xl p-4 mb-3 relative overflow-hidden"
             style={{ background: "linear-gradient(135deg, var(--accent-soft), transparent)", border: "1px solid var(--border-strong)" }}>
          <div className="text-[11px] text-[var(--text-faint)]">{lang==='en'?'Avg score':"O'rtacha ball"}</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-4xl gradient-text">17.2</span>
            <span className="text-[var(--text-faint)]">/ 20</span>
            <span className="ml-auto text-emerald-400 text-sm font-mono">86%</span>
          </div>
          <div className="mt-2 text-[11px] text-[var(--text-dim)]">{t('omr.compare')}</div>
        </div>

        {/* Ranking */}
        <div className="text-[11px] text-[var(--text-faint)] mb-2">{lang==='en'?'Ranking':"Reyting"}</div>
        <div className="flex flex-col gap-1.5">
          {students.map((s, i) => {
            const visible = phase === 2 ? i < students.length : phase === 1 ? i < Math.min(3, students.length) : 0;
            return (
              <div key={i} className={"flex items-center gap-3 px-3 py-2 rounded-lg transition-all " +
                  (visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3")}
                  style={{
                    background: s.rank === 1 ? "linear-gradient(90deg, var(--accent-soft), transparent)" : "var(--surface)",
                    border: "1px solid var(--border)",
                    transitionDelay: `${i*0.08}s`,
                  }}>
                <span className={"w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold " +
                    (s.rank === 1 ? "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white" : "bg-[var(--surface-2)] text-[var(--text-dim)]")}>
                  {s.rank}
                </span>
                <span className="flex-1 text-[12px]">{s.name}</span>
                <span className="font-mono text-[12px]">{s.score}/20</span>
                <div className="w-14 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]" style={{ width: `${(s.score/20)*100}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-4 flex items-center gap-2 text-[11px]">
          <span className="chip"><Icon name="zap" size={12} className="text-[var(--accent-2)]" /> {t('omr.saved')}</span>
          <button className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] bg-[var(--surface-2)] border border-[var(--border)]">
            <Icon name="download" size={12} /> Excel
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OMRDemo });
