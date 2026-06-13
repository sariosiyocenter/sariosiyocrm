/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useCRM } from './context/CRMContext';

// Eager (har doim kerak)
import Login from './components/Login';
import Layout from './components/Layout';

// Lazy (faqat kirish kerak bo'lganda yuklanadi)
const LandingPage     = lazy(() => import('./components/LandingPage'));
const Dashboard       = lazy(() => import('./components/Dashboard'));
const Teachers        = lazy(() => import('./components/Teachers'));
const TeacherDetails  = lazy(() => import('./components/TeacherDetails'));
const Courses          = lazy(() => import('./components/Courses'));
const CourseDetails    = lazy(() => import('./components/CourseDetails'));
const SyllabusManager  = lazy(() => import('./components/SyllabusManager'));
const Students        = lazy(() => import('./components/Students'));
const StudentDetails  = lazy(() => import('./components/StudentDetails'));
const Leads           = lazy(() => import('./components/Leads'));
const Finance         = lazy(() => import('./components/Finance'));
const Settings        = lazy(() => import('./components/Settings'));
const Reports         = lazy(() => import('./components/Reports'));
const Logistics       = lazy(() => import('./components/Logistics'));
const SmsHistory      = lazy(() => import('./components/SmsHistory'));
const ExamsList       = lazy(() => import('./components/ExamsList'));
const ExamBuilder     = lazy(() => import('./components/ExamBuilder'));
const ExamDetail      = lazy(() => import('./components/ExamDetail'));
const Scanner         = lazy(() => import('./components/Scanner'));
const QuestionsList   = lazy(() => import('./components/QuestionsList'));
const QuestionEditor  = lazy(() => import('./components/QuestionEditor'));
const ExamResults     = lazy(() => import('./components/ExamResults'));
const SuperAdmin      = lazy(() => import('./components/SuperAdmin'));
const OrgDetail       = lazy(() => import('./components/OrgDetail'));
const HRManagement    = lazy(() => import('./components/HRManagement'));
const StaffDetails    = lazy(() => import('./components/StaffDetails'));
const PublicApply     = lazy(() => import('./components/PublicApply'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-[#1b6b6b] border-t-transparent rounded-full animate-spin" />
        <p className="text-[14px] text-gray-500 font-medium">Yuklanmoqda...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, logout, loading } = useCRM();

  const isApplyRoute = window.location.pathname.startsWith('/apply');

  if (loading) {
    return <PageLoader />;
  }

  if (isApplyRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/apply/:schoolId" element={<PublicApply />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"      element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="*"      element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  const role = user?.role;
  const isSuperAdmin = role === 'SUPERADMIN';
  const isSaaSUser = role === 'SUPERADMIN' || role === 'SELLER';
  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';
  const isAdmin = role === 'ADMIN';

  return (
    <Layout onLogout={logout}>
      <Suspense fallback={<PageLoader />}>
        {isSaaSUser ? (
          <Routes>
            <Route path="/"           element={<SuperAdmin />} />
            <Route path="/superadmin" element={<SuperAdmin />} />
            {isSuperAdmin && <Route path="/org/:id"    element={<OrgDetail />} />}
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/"                     element={<Dashboard />} />
            <Route path="/leads"                element={<Leads />} />
            <Route path="/teachers/:id"         element={isAdminOrManager ? <TeacherDetails /> : <Navigate to="/" replace />} />
            <Route path="/courses"               element={<Courses />} />
            <Route path="/courses/:id"           element={<CourseDetails />} />
            <Route path="/syllabus"             element={<SyllabusManager />} />
            <Route path="/students"             element={<Students />} />
            <Route path="/students/:id"         element={<StudentDetails />} />
            <Route path="/hr"                   element={isAdminOrManager ? <HRManagement /> : <Navigate to="/" replace />} />
            <Route path="/hr/:id"              element={isAdminOrManager ? <StaffDetails />  : <Navigate to="/" replace />} />
            <Route path="/settings"             element={isAdminOrManager ? <Settings />   : <Navigate to="/" replace />} />
            <Route path="/finance"              element={isAdminOrManager ? <Finance />    : <Navigate to="/" replace />} />
            <Route path="/logistics"            element={isAdminOrManager ? <Logistics />  : <Navigate to="/" replace />} />
            <Route path="/reports"              element={isAdmin           ? <Reports />    : <Navigate to="/" replace />} />
            <Route path="/exams"                element={isAdminOrManager ? <ExamsList />   : <Navigate to="/" replace />} />
            <Route path="/exams/new"            element={isAdminOrManager ? <ExamBuilder /> : <Navigate to="/" replace />} />
            <Route path="/exams/:id"            element={isAdminOrManager ? <ExamDetail />  : <Navigate to="/" replace />} />
            <Route path="/scanner"              element={<Navigate to="/exams" replace />} />
            <Route path="/questions"            element={<Navigate to="/exams" replace />} />
            <Route path="/questions/new"        element={isAdminOrManager ? <QuestionEditor /> : <Navigate to="/" replace />} />
            <Route path="/questions/:id/edit"   element={isAdminOrManager ? <QuestionEditor /> : <Navigate to="/" replace />} />
            <Route path="/exam-results"         element={isAdminOrManager ? <ExamResults />    : <Navigate to="/" replace />} />
            <Route path="*"                     element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Suspense>
    </Layout>
  );
}
