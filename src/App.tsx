/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
import SmsHistory from './components/SmsHistory';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import ExamsList from './components/ExamsList';
import ExamBuilder from './components/ExamBuilder';
import ExamDetail from './components/ExamDetail';
import Scanner from './components/Scanner';
import QuestionsList from './components/QuestionsList';
import QuestionEditor from './components/QuestionEditor';
import ExamResults from './components/ExamResults';

export default function App() {
  const { user, logout, loading } = useCRM();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#1b6b6b] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[14px] text-gray-500 font-medium">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
        <Route path="/sms-history" element={isAdminOrManager ? <SmsHistory /> : <Navigate to="/" replace />} />
        <Route path="/reports" element={isAdmin ? <Reports /> : <Navigate to="/" replace />} />
        <Route path="/exams" element={isAdminOrManager ? <ExamsList /> : <Navigate to="/" replace />} />
        <Route path="/exams/new" element={isAdminOrManager ? <ExamBuilder /> : <Navigate to="/" replace />} />
        <Route path="/exams/:id" element={isAdminOrManager ? <ExamDetail /> : <Navigate to="/" replace />} />
        <Route path="/scanner" element={isAdminOrManager ? <Scanner /> : <Navigate to="/" replace />} />
        <Route path="/questions" element={isAdminOrManager ? <QuestionsList /> : <Navigate to="/" replace />} />
        <Route path="/questions/new" element={isAdminOrManager ? <QuestionEditor /> : <Navigate to="/" replace />} />
        <Route path="/questions/:id/edit" element={isAdminOrManager ? <QuestionEditor /> : <Navigate to="/" replace />} />
        <Route path="/exam-results" element={isAdminOrManager ? <ExamResults /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
