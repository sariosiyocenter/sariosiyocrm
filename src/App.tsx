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
import Logistics from './components/Logistics';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[14px] text-gray-500 font-medium">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-[400px]">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-xl mb-4 shadow-lg shadow-indigo-600/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Sariosiyo CRM</h1>
            <p className="text-[14px] text-gray-500 mt-1">Tizimga kirish</p>
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
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] text-gray-900 outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all placeholder:text-gray-400"
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
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] text-gray-900 outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all placeholder:text-gray-400"
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg text-[14px] font-semibold hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-50 mt-2 shadow-md shadow-indigo-600/20"
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
        <Route path="/logistics" element={isAdminOrManager ? <Logistics /> : <Navigate to="/" replace />} />
        <Route path="/reports" element={isAdmin ? <Reports /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
