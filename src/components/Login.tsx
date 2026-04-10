import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';

export default function Login() {
  const { login, error: authError } = useCRM();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 uppercase">Sariosiyo CRM</h1>
          <p className="text-[14px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Tizimga kirish</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {authError && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-[13px] font-medium border border-red-100">
                {authError}
              </div>
            )}
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] text-gray-900 outline-none focus:bg-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 transition-all placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Parol</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] text-gray-900 outline-none focus:bg-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 transition-all placeholder:text-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-[#1b6b6b] text-white rounded-lg text-[14px] font-semibold hover:bg-[#0d4d4d] active:scale-[0.99] transition-all disabled:opacity-50 mt-2 shadow-md shadow-[#1b6b6b]/20"
            >
              {loginLoading ? 'Yuklanmoqda...' : 'Kirish'}
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] text-gray-400 mt-8">© 2026 Sariosiyo CRM</p>
      </div>
    </div>
  );
}
