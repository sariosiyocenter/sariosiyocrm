// sections.jsx — Nav, Hero shell, Logos, Features, Pricing, FAQ, CTA, Footer.
// All strings come through the t() helper from i18n.jsx.

/* ───────────────────────── Nav ───────────────────────── */
function Nav({ t, lang, setLang, dark, setDark, onOpenModal }) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav className={"fixed top-3 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 " +
      (scrolled ? "w-[min(1180px,calc(100%-1.5rem))]" : "w-[min(1240px,calc(100%-1.5rem))]")}>
      <div className="glass-strong rounded-2xl px-4 py-2.5 flex items-center gap-2"
           style={{ boxShadow: scrolled ? "0 20px 60px -30px rgba(0,0,0,0.6)" : "none" }}>
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center relative">
            <Icon name="atom" size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-[16px]">Quantum</span>
          <span className="text-[10px] text-[var(--text-faint)] -ml-1 font-mono">CRM</span>
        </a>

        <div className="hidden md:flex items-center gap-1 text-sm">
          <NavLink href="#features">{t('nav.features')}</NavLink>
          <NavLink href="#preview">{t('nav.preview')}</NavLink>
          <NavLink href="#pricing">{t('nav.pricing')}</NavLink>
          <NavLink href="#faq">{t('nav.faq')}</NavLink>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Lang toggle */}
          <div className="hidden sm:flex glass rounded-lg p-0.5 text-[11px] font-medium">
            {["uz","en"].map((l) => (
              <button key={l} onClick={() => setLang(l)}
                className={"px-2 py-1 rounded-md " + (lang===l ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-faint)]")}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Theme toggle */}
          <button onClick={() => setDark(!dark)} className="glass rounded-lg w-8 h-8 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)]" aria-label="Theme">
            <Icon name={dark ? "sun" : "moon"} size={15} />
          </button>
          {/* Sign in */}
          <button className="hidden sm:inline-flex text-sm px-3 py-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)]">
            {t('nav.login')}
          </button>
          {/* CTA */}
          <button onClick={() => onOpenModal()} className="btn-primary inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-lg">
            {t('nav.cta')} <Icon name="arrow-right" size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
function NavLink({ href, children }) {
  return <a href={href} className="px-3 py-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition">{children}</a>;
}

/* ───────────────────────── Hero ───────────────────────── */
function Hero({ t, lang, onOpenModal }) {
  return (
    <section className="relative pt-32 pb-16 px-4">
      <div className="max-w-6xl mx-auto text-center relative">
        <div className="chip mb-6 mx-auto">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[var(--accent-2)] pulse-soft"></span>
            <span className="absolute inset-0 rounded-full bg-[var(--accent-2)]"></span>
          </span>
          <Icon name="sparkles" size={13} className="text-[var(--accent-2)]" />
          {t('hero.badge')}
        </div>

        <h1 className="font-display font-bold tracking-tight text-[clamp(2.5rem,6vw,5rem)] leading-[1.04]">
          <span className="block">{t('hero.titleA')}</span>
          <span className="block gradient-text">{t('hero.titleB')}</span>
          <span className="block">{t('hero.titleC')}</span>
        </h1>

        <p className="mt-6 text-[var(--text-dim)] text-lg max-w-2xl mx-auto leading-relaxed text-balance">
          {t('hero.sub')}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => onOpenModal()} className="btn-primary inline-flex items-center gap-2 text-base px-5 py-3 rounded-xl">
            <Icon name="rocket" size={16} /> {t('hero.cta1')}
          </button>
          <button onClick={() => onOpenModal()} className="btn-secondary inline-flex items-center gap-2 text-base px-5 py-3 rounded-xl">
            <Icon name="play-circle" size={16} /> {t('hero.cta2')}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[12.5px] text-[var(--text-faint)]">
          <span className="inline-flex items-center gap-1.5"><Icon name="check" size={12} className="text-emerald-400"/> {t('hero.trust')}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="check" size={12} className="text-emerald-400"/> {t('hero.trust2')}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="check" size={12} className="text-emerald-400"/> {t('hero.trust3')}</span>
        </div>
      </div>

      {/* Dashboard mockup */}
      <div className="max-w-6xl mx-auto mt-16 relative">
        <DashboardMockup lang={lang} />
      </div>
    </section>
  );
}

/* ───────────────────────── Logos / Stats ───────────────────────── */
function Logos({ t }) {
  const logos = ["Khan Academy UZ","Praktikum","BilimLand","EduPro","Skillbox UZ","CodeX","Master Class","Smart School","IT Park","Logic Academy"];
  const stats = [t('logos.stat1'), t('logos.stat2'), t('logos.stat3'), t('logos.stat4')];

  return (
    <section className="py-14 relative">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center text-[var(--text-faint)] text-sm uppercase tracking-[0.18em] mb-6">
          {t('logos.title')}
        </div>
        <div className="marquee overflow-hidden">
          <div className="marquee-track flex gap-10 w-max">
            {[...logos, ...logos].map((l, i) => (
              <div key={i} className="logo-ph">{l}</div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="glass rounded-2xl p-5 text-center">
              <div className="font-display font-bold text-[clamp(1.8rem,3vw,2.4rem)] gradient-text">{s.num}</div>
              <div className="text-[12px] text-[var(--text-dim)] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Features ───────────────────────── */
function Features({ t }) {
  const items = t('features.items');
  return (
    <section id="features" className="py-20 relative">
      <div className="max-w-6xl mx-auto px-4">
        <SectionHeading kicker={t('features.kicker')} title={t('features.title')} sub={t('features.sub')} />

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it, i) => (
            <div key={i} className="glass rounded-2xl p-6 group relative overflow-hidden hover:-translate-y-1 transition-transform">
              {/* hover glow */}
              <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition pointer-events-none"
                   style={{ boxShadow: "0 0 50px -10px var(--accent-soft) inset", border: "1px solid var(--accent-soft)" }}></div>

              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center neon-ring">
                  <Icon name={it.icon} size={20} className="text-white" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--accent-2)] font-medium">{it.tag}</span>
              </div>
              <h3 className="font-display font-bold text-[18px] mb-1.5">{it.title}</h3>
              <p className="text-[13.5px] text-[var(--text-dim)] leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ kicker, title, sub, align = 'center' }) {
  return (
    <div className={"max-w-2xl " + (align === 'center' ? "mx-auto text-center" : "")}>
      <div className="chip mb-4 mx-auto"><span className="w-1 h-1 rounded-full bg-[var(--accent-2)]"></span>{kicker}</div>
      <h2 className="font-display font-bold tracking-tight text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] text-balance">
        {title}
      </h2>
      {sub && <p className="mt-4 text-[var(--text-dim)] text-base leading-relaxed">{sub}</p>}
    </div>
  );
}

/* ───────────────────────── Preview wrapper ───────────────────────── */
function PreviewSection({ t, lang }) {
  return (
    <section id="preview" className="py-20 relative">
      <div className="max-w-6xl mx-auto px-4">
        <SectionHeading kicker={t('preview.kicker')} title={t('preview.title')} sub={t('preview.sub')} />
        <div className="mt-12">
          <PreviewTabs lang={lang} t={t} />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── OMR wrapper ───────────────────────── */
function OMRSection({ t, lang }) {
  return (
    <section className="py-20 relative">
      <div className="max-w-6xl mx-auto px-4">
        <SectionHeading kicker={t('omr.kicker')} title={t('omr.title')} sub={t('omr.sub')} />
        <div className="mt-12">
          <OMRDemo lang={lang} t={t} />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Pricing ───────────────────────── */
function Pricing({ t, onOpenModal }) {
  const [yearly, setYearly] = React.useState(false);
  const plans = t('pricing.plans');

  return (
    <section id="pricing" className="py-20 relative">
      <div className="max-w-6xl mx-auto px-4">
        <SectionHeading kicker={t('pricing.kicker')} title={t('pricing.title')} sub={t('pricing.sub')} />

        {/* Toggle */}
        <div className="mt-8 flex justify-center">
          <div className="glass rounded-xl p-1 flex items-center gap-1 relative">
            {["monthly", "yearly"].map((k) => {
              const on = (k === "yearly") === yearly;
              return (
                <button key={k} onClick={() => setYearly(k === "yearly")}
                  className={"relative px-5 py-2 rounded-lg text-sm font-medium transition " + (on ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white" : "text-[var(--text-dim)]")}>
                  {t('pricing.' + k)}
                  {k === "yearly" && (
                    <span className="ml-2 text-[9.5px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-medium">
                      {t('pricing.save')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {plans.map((p, i) => {
            const popular = i === 1;
            return (
              <div key={i} className={"relative rounded-2xl p-6 " + (popular ? "glass-strong pulse-border" : "glass")}
                   style={popular ? { background: "linear-gradient(180deg, var(--accent-soft), var(--surface))" } : {}}>
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10.5px] uppercase tracking-wider font-semibold bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white">
                    {t('pricing.mostPopular')}
                  </span>
                )}
                <div className="font-display font-bold text-xl">{p.name}</div>
                <div className="text-[12.5px] text-[var(--text-dim)] mt-1">{p.desc}</div>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display font-bold text-[40px] tabular-nums">
                    {yearly ? p.price.y : p.price.m}
                  </span>
                  {(p.price.m !== "Maxsus" && p.price.m !== "Custom") && (
                    <span className="text-[12px] text-[var(--text-faint)]">{t('pricing.currency')}{t('pricing.perMonth')}</span>
                  )}
                </div>

                <button onClick={() => onOpenModal(p.name)} className={"mt-5 w-full py-2.5 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 " +
                  (popular ? "btn-primary" : "btn-secondary")}>
                  {popular ? t('pricing.ctaPop') : t('pricing.cta')}
                  <Icon name="arrow-right" size={14} />
                </button>

                <div className="mt-6 flex flex-col gap-2.5">
                  {p.features.map((f, fi) => (
                    <div key={fi} className="flex items-start gap-2 text-[13px]">
                      <Icon name="check" size={14} className="text-[var(--accent-2)] mt-0.5" />
                      <span className="text-[var(--text-dim)]">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */
function FAQ({ t }) {
  const items = t('faq.items');
  const [open, setOpen] = React.useState(0);
  return (
    <section id="faq" className="py-20 relative">
      <div className="max-w-3xl mx-auto px-4">
        <SectionHeading kicker={t('faq.kicker')} title={t('faq.title')} />

        <div className="mt-10 flex flex-col gap-2">
          {items.map((it, i) => {
            const on = open === i;
            return (
              <div key={i} className={"glass rounded-xl overflow-hidden transition " + (on ? "border-[var(--accent-soft)]" : "")}>
                <button onClick={() => setOpen(on ? -1 : i)}
                  className="w-full px-5 py-4 flex items-center gap-3 text-left">
                  <span className="font-display font-medium flex-1">{it.q}</span>
                  <span className={"w-7 h-7 rounded-full bg-[var(--surface-2)] flex items-center justify-center transition " + (on ? "rotate-45 text-[var(--accent-2)]" : "text-[var(--text-faint)]")}>
                    <Icon name="plus" size={14} />
                  </span>
                </button>
                <div className="grid transition-[grid-template-rows] duration-300"
                     style={{ gridTemplateRows: on ? "1fr" : "0fr" }}>
                  <div className="overflow-hidden">
                    <div className="px-5 pb-4 text-[14px] text-[var(--text-dim)] leading-relaxed">
                      {it.a}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Final CTA ───────────────────────── */
function FinalCTA({ t, onOpenModal }) {
  return (
    <section className="py-20 relative">
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden glass-strong p-12 text-center"
             style={{
               background: "radial-gradient(ellipse at top, var(--accent-soft), transparent 60%), var(--surface-2)",
               boxShadow: "0 30px 100px -30px var(--accent-soft), 0 0 0 1px var(--border-strong)"
             }}>
          {/* decorative grid */}
          <div className="absolute inset-0 opacity-30 pointer-events-none"
               style={{
                 backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
                 backgroundSize: "32px 32px",
                 mask: "radial-gradient(ellipse at center, black, transparent 70%)",
                 WebkitMask: "radial-gradient(ellipse at center, black, transparent 70%)",
               }}></div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 chip mb-6">
              <Icon name="gift" size={13} className="text-[var(--accent-2)]" />
              14 days · 100% free
            </div>
            <h2 className="font-display font-bold text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05] text-balance">
              {t('cta.title')}
            </h2>
            <p className="mt-5 text-[var(--text-dim)] max-w-xl mx-auto text-balance">{t('cta.sub')}</p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center">
              <button onClick={() => onOpenModal()} className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base">
                <Icon name="rocket" size={16} /> {t('cta.btn')}
              </button>
              <button onClick={() => onOpenModal()} className="btn-secondary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base">
                <Icon name="phone-call" size={16} /> {t('cta.btn2')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */
function Footer({ t }) {
  const cols = [
    { title: t('footer.product'), links: t('footer.product_links') },
    { title: t('footer.company'), links: t('footer.company_links') },
    { title: t('footer.support'), links: t('footer.support_links') },
    { title: t('footer.legal'),   links: t('footer.legal_links') },
  ];
  return (
    <footer className="border-t border-[var(--border)] pt-14 pb-8 relative">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-[1.6fr,repeat(4,1fr)] gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center">
                <Icon name="atom" size={18} className="text-white" />
              </div>
              <span className="font-display font-bold text-[16px]">Quantum</span>
              <span className="text-[10px] text-[var(--text-faint)] font-mono">CRM</span>
            </div>
            <p className="text-[13px] text-[var(--text-dim)] max-w-xs leading-relaxed">{t('footer.tagline')}</p>
            <div className="mt-4 flex gap-2">
              {["instagram","send","youtube","linkedin","github"].map((s) => (
                <a key={s} href="#" className="w-9 h-9 rounded-lg glass flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)]">
                  <Icon name={s} size={14} />
                </a>
              ))}
            </div>
          </div>

          {cols.map((c, i) => (
            <div key={i}>
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-3 font-semibold">{c.title}</div>
              <ul className="flex flex-col gap-2 text-[13px]">
                {c.links.map((l, li) => <li key={li}><a href="#" className="text-[var(--text-dim)] hover:text-[var(--text)]">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-[var(--border)] flex flex-wrap items-center gap-3 text-[12px] text-[var(--text-faint)]">
          <span>{t('footer.rights')}</span>
          <span className="ml-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft"></span> All systems operational</span>
            <span>·</span>
            <span className="font-mono">v 2.7.4</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Nav, Hero, Logos, Features, PreviewSection, OMRSection, Pricing, FAQ, FinalCTA, Footer, SectionHeading });
