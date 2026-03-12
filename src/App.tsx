/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useCRM } from './context/CRMContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Teachers from './components/Teachers';
import TeacherDetails from './components/TeacherDetails';
import Groups from './components/Groups';
import GroupDetails from './components/GroupDetails';
import Students from './components/Students';
import Leads from './components/Leads';
import Finance from './components/Finance';
import Settings from './components/Settings';
import Reports from './components/Reports';
import StudentDetails from './components/StudentDetails';

export default function App() {
  const { user, login, logout, loading, error: authError } = useCRM();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Yuklamoqda...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] w-full max-w-md p-10 shadow-2xl border border-slate-100">
          <div className="flex flex-col items-center gap-6 mb-10">
            <div className="w-20 h-20 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white font-bold overflow-hidden shadow-xl">
              <img src="https://api.dicebear.com/7.x/shapes/svg?seed=SARIOSIYO&backgroundColor=000000" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">SARIOSIYO CRM</h1>
              <p className="text-slate-500 font-medium text-sm">Tizimga xush kelibsiz!</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {authError && (
              <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm font-bold border border-red-100">
                {authError}
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Login (Email)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#5C67F2] focus:bg-white transition-all text-sm font-semibold text-slate-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Parol</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#5C67F2] focus:bg-white transition-all text-sm font-semibold text-slate-700"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-4 bg-[#5C67F2] text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all mt-4 uppercase tracking-widest text-sm disabled:opacity-50"
            >
              {loginLoading ? 'KIRISH...' : 'KIRISH'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const role = user?.role;
  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';
  const isAdmin = role === 'ADMIN';

  return (
    <Layout onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/teachers" element={isAdminOrManager ? <Teachers /> : <Navigate to="/" replace />} />
        <Route path="/teachers/:id" element={isAdminOrManager ? <TeacherDetails /> : <Navigate to="/" replace />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:id" element={<GroupDetails />} />
        <Route path="/students" element={<Students />} />
        <Route path="/students/:id" element={<StudentDetails />} />
        <Route path="/settings" element={isAdminOrManager ? <Settings /> : <Navigate to="/" replace />} />
        <Route path="/finance" element={isAdminOrManager ? <Finance /> : <Navigate to="/" replace />} />
        <Route path="/reports" element={isAdmin ? <Reports /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
