import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { Atom, Lock, Mail, ArrowRight, ShieldAlert } from 'lucide-react';

export default function Login() {
  const { login, error: authError } = useCRM();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const navigate = useNavigate();

  // Track cursor glow follower
  useEffect(() => {
    const el = document.getElementById('login-cursor-glow');
    if (!el) return;
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let tx = x, ty = y;
    const onMove = (e: MouseEvent) => { tx = e.clientX; ty = e.clientY; };
    window.addEventListener('mousemove', onMove);
    
    let active = true;
    function tick() {
      if (!active) return;
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      if (el) {
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      }
      requestAnimationFrame(tick);
    }
    tick();

    return () => {
      active = false;
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoginLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      // Error is handled in context
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative text-slate-100 font-sans flex items-center justify-center p-4 overflow-hidden" style={{ background: '#07090f' }}>
      {/* Styles */}
      <style dangerouslySetInnerHTML={{ __html: INLINE_STYLES }} />

      {/* Aurora visual glow meshes */}
      <div className="login-aurora">
        <div className="login-aurora-glow"></div>
      </div>
      <div className="login-grid-overlay"></div>
      <div id="login-cursor-glow" className="login-cursor-glow"></div>

      <div className="w-full max-w-[420px] relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Logo Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 border border-white/10 mb-4 animate-float">
            <Atom size={32} className="text-white animate-spin-slow" />
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent">
            Quantum Edu
          </h1>
          <p className="text-[11px] text-indigo-400/80 font-bold uppercase tracking-[0.25em] mt-2">
            Tizimga kirish
          </p>
        </div>

        {/* Login Card */}
        <div className="login-glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-500">
          
          <form onSubmit={handleLogin} className="space-y-5">
            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-[13px] font-medium flex items-center gap-2.5 animate-bounce-soft">
                <ShieldAlert size={16} className="text-red-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Email manzil
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-950/40 border border-slate-800 rounded-xl text-sm text-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-600 outline-none transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Maxfiy parol
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-950/40 border border-slate-800 rounded-xl text-sm text-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-600 outline-none transition-all duration-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 active:scale-[0.98] disabled:opacity-50 mt-2 shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.35)] cursor-pointer flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Yuklanmoqda...</span>
                </>
              ) : (
                <>
                  <span>Tizimga kirish</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-8">
          <p className="text-[11px] text-slate-600 tracking-wider font-medium">
            © 2026 Quantum Edu. Barcha huquqlar himoyalangan.
          </p>
        </div>
      </div>
    </div>
  );
}

const INLINE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap');

  .font-display {
    font-family: 'Space Grotesk', sans-serif;
  }

  .animate-spin-slow {
    animation: spin 16s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .animate-float {
    animation: float 6s ease-in-out infinite;
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  @keyframes bounce-soft {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }
  .animate-bounce-soft {
    animation: bounce-soft 2s ease-in-out infinite;
  }

  .login-aurora {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    overflow: hidden;
  }
  .login-aurora-glow {
    position: absolute; width: 60vw; height: 60vw;
    left: 20vw; top: -15vw;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.1) 40%, transparent 70%);
    filter: blur(80px);
    animation: drift 20s ease-in-out infinite alternate;
  }
  @keyframes drift {
    0% { transform: translate(-5vw, -5vh) scale(1); }
    100% { transform: translate(5vw, 5vh) scale(1.1); }
  }

  .login-grid-overlay {
    position: fixed; inset: 0; z-index: 1; pointer-events: none;
    background-image:
      linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(circle at center, black 0%, transparent 80%);
    -webkit-mask-image: radial-gradient(circle at center, black 0%, transparent 80%);
  }

  .login-cursor-glow {
    position: fixed; pointer-events: none; z-index: 2;
    width: 320px; height: 320px; border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 60%);
    filter: blur(40px);
    transform: translate(-50%, -50%);
    transition: opacity .4s;
    mix-blend-mode: screen;
  }

  .login-glass-card {
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  input:-webkit-autofill,
  input:-webkit-autofill:hover, 
  input:-webkit-autofill:focus {
    -webkit-text-fill-color: #e6e9f2 !important;
    -webkit-box-shadow: 0 0 0px 1000px #090d16 inset !important;
    transition: background-color 5000s ease-in-out 0s;
  }
`;
