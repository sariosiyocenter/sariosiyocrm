// app.jsx — Root component. Owns language, theme and tweak state, applies
// CSS custom properties for accent palette, glow and blur from Tweaks.

const ACCENT_PALETTES = {
  indigo:  { a: "#6366f1", b: "#a855f7", soft: "rgba(99,102,241,0.18)",  label: "Indigo" },
  violet:  { a: "#a855f7", b: "#ec4899", soft: "rgba(168,85,247,0.18)",  label: "Violet" },
  emerald: { a: "#10b981", b: "#14b8a6", soft: "rgba(16,185,129,0.18)",  label: "Emerald" },
  amber:   { a: "#f59e0b", b: "#f97316", soft: "rgba(245,158,11,0.18)",  label: "Amber" },
};

function App() {
  const [tw, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const [lang, setLang] = React.useState('uz');
  const [dark, setDark] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [modalPlan, setModalPlan] = React.useState('');
  const t = React.useMemo(() => makeT(lang), [lang]);

  // Apply theme class
  React.useEffect(() => {
    document.documentElement.classList.toggle('light', !dark);
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Apply tweaks to CSS vars
  React.useEffect(() => {
    const p = ACCENT_PALETTES[tw.accent] || ACCENT_PALETTES.indigo;
    const root = document.documentElement;
    root.style.setProperty('--accent', p.a);
    root.style.setProperty('--accent-2', p.b);
    root.style.setProperty('--accent-soft', p.soft);
    root.style.setProperty('--glow', String(tw.glow));
    root.style.setProperty('--blur', String(tw.blur));
  }, [tw]);

  const handleOpenModal = (planName = '') => {
    setModalPlan(planName);
    setShowModal(true);
  };

  return (
    <div className="relative z-10">
      <Nav t={t} lang={lang} setLang={setLang} dark={dark} setDark={setDark} onOpenModal={() => handleOpenModal()} />
      <Hero t={t} lang={lang} onOpenModal={() => handleOpenModal('Biznes')} />
      <Logos t={t} />
      <Features t={t} />
      <PreviewSection t={t} lang={lang} />
      <OMRSection t={t} lang={lang} />
      <Pricing t={t} onOpenModal={handleOpenModal} />
      <FAQ t={t} />
      <FinalCTA t={t} onOpenModal={() => handleOpenModal()} />
      <Footer t={t} />

      {showModal && (
        <TrialModal t={t} lang={lang} plan={modalPlan} onClose={() => setShowModal(false)} />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label={lang==='en'?'Accent palette':"Urg'u rang"} />
        <TweakColor label={lang==='en'?'Palette':"Palitra"}
                    value={tw.accent}
                    options={[
                      { value: "indigo",  label: "Indigo" },
                      { value: "violet",  label: "Violet" },
                      { value: "emerald", label: "Emerald" },
                      { value: "amber",   label: "Amber" },
                    ].map(o => ({ value: o.value, label: o.label }))}
                    onChange={(v) => setTweak('accent', v)} />
        {/* Custom swatch row for visual clarity */}
        <div className="twk-chips" style={{ display: 'flex', gap: 6 }}>
          {Object.entries(ACCENT_PALETTES).map(([k, p]) => {
            const on = tw.accent === k;
            return (
              <button key={k} type="button"
                      onClick={() => setTweak('accent', k)}
                      className="twk-chip" data-on={on ? '1' : '0'}
                      title={p.label}
                      style={{ background: `linear-gradient(135deg, ${p.a}, ${p.b})` }}>
              </button>
            );
          })}
        </div>

        <TweakSection label={lang==='en'?'Effects':"Effektlar"} />
        <TweakSlider label={lang==='en'?'Neon glow':"Neon yorqinligi"}
                     value={tw.glow} min={0} max={80} step={2} unit="%"
                     onChange={(v) => setTweak('glow', v)} />
        <TweakSlider label={lang==='en'?'Glass blur':"Glass blur"}
                     value={tw.blur} min={0} max={40} step={2} unit="px"
                     onChange={(v) => setTweak('blur', v)} />

        <TweakSection label={lang==='en'?'Display':"Ko'rinish"} />
        <TweakRadio label={lang==='en'?'Theme':"Mavzu"}
                    value={dark ? 'dark' : 'light'}
                    options={[
                      { value: 'dark',  label: lang==='en'?'Dark':"To'q" },
                      { value: 'light', label: lang==='en'?'Light':"Yorug'" }
                    ]}
                    onChange={(v) => setDark(v === 'dark')} />
        <TweakRadio label={lang==='en'?'Language':"Til"}
                    value={lang}
                    options={[{ value: 'uz', label: "O'zbek" }, { value: 'en', label: "English" }]}
                    onChange={setLang} />
      </TweaksPanel>
    </div>
  );
}

function TrialModal({ t, lang, plan, onClose }) {
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [center, setCenter] = React.useState('');
  const [selPlan, setSelPlan] = React.useState(plan || 'Biznes');
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !phone || !center) {
      alert(lang === 'en' ? 'Please fill in all fields' : "Iltimos, barcha maydonlarni to'ldiring");
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-[var(--bg-2)] border border-[var(--border-strong)] rounded-3xl p-7 shadow-2xl pulse-border flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="text-center pb-2">
              <h3 className="font-display font-bold text-xl text-[var(--text)]">
                {lang === 'en' ? 'Start Free Trial' : 'Bepul sinab ko\'rish'}
              </h3>
              <p className="text-xs text-[var(--text-dim)] mt-1.5 leading-relaxed">
                {lang === 'en' ? 'Get 14 days of free access and onboarding support!' : '14 kunlik bepul sinov va bepul sozlab berish sovg\'asiga ega bo\'ling!'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{lang === 'en' ? 'Full Name' : 'F.I.Sh.'}</label>
              <input 
                type="text" 
                required
                placeholder={lang === 'en' ? 'Enter your full name' : 'Ism familiyangizni kiriting'}
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl px-4 py-3 outline-none text-sm transition-all placeholder:text-[var(--text-faint)] text-[var(--text)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{lang === 'en' ? 'Phone Number' : 'Telefon raqami'}</label>
              <input 
                type="tel" 
                required
                placeholder="+998 (90) 123-45-67"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl px-4 py-3 outline-none text-sm transition-all placeholder:text-[var(--text-faint)] text-[var(--text)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{lang === 'en' ? 'Learning Center Name' : 'O\'quv markazi nomi'}</label>
              <input 
                type="text" 
                required
                placeholder={lang === 'en' ? 'Name of your academy' : 'Markaz yoki maktabingiz nomi'}
                value={center}
                onChange={e => setCenter(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl px-4 py-3 outline-none text-sm transition-all placeholder:text-[var(--text-faint)] text-[var(--text)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{lang === 'en' ? 'Select Plan' : 'Tarifni tanlang'}</label>
              <select 
                value={selPlan}
                onChange={e => setSelPlan(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl px-4 py-3 outline-none text-sm transition-all text-[var(--text)] cursor-pointer"
              >
                <option value="Boshlang'ich">{lang === 'en' ? 'Starter (Starter)' : 'Boshlang\'ich (200 o\'quvchi)'}</option>
                <option value="Biznes">{lang === 'en' ? 'Business (Business)' : 'Biznes (1000 o\'quvchi)'}</option>
                <option value="Enterprise">{lang === 'en' ? 'Enterprise (Enterprise)' : 'Enterprise (Cheksiz)'}</option>
              </select>
            </div>

            <button type="submit" className="btn-primary w-full py-3.5 rounded-xl font-semibold text-sm transition-all mt-2 hover:scale-[1.02] flex items-center justify-center gap-2">
              {lang === 'en' ? 'Start Free Trial Now' : 'Bepul sinashni boshlash'}
            </button>
          </form>
        ) : (
          <div className="text-center py-8 flex flex-col items-center gap-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-[var(--text)]">
                {lang === 'en' ? 'Request Submitted!' : 'So\'rovingiz qabul qilindi!'}
              </h3>
              <p className="text-xs text-[var(--text-dim)] mt-2 leading-relaxed max-w-xs mx-auto">
                {lang === 'en' 
                  ? 'Congratulations! A dedicated Quantum onboarding manager will contact you within 24 hours to set up your account!' 
                  : 'Tabriklaymiz! Quantum shaxsiy menejeri 24 soat ichida siz bilan bog\'lanib, o\'quv markazingiz uchun tizimni to\'liq bepul sozlab beradi!'}
              </p>
            </div>
            <button onClick={onClose} className="btn-secondary px-8 py-2.5 rounded-xl font-semibold text-sm transition-all mt-4">
              {lang === 'en' ? 'Close' : 'Yopish'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
