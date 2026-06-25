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

// Helper to reload page if a dynamic import fails due to new deployment chunks mismatch
function lazyRetry<T extends React.ComponentType<any>>(componentImport: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.error("Chunk load failed, reloading page...", error);
      const hasReloaded = sessionStorage.getItem('chunk-reload-flag');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk-reload-flag', 'true');
        window.location.reload();
      }
      throw error;
    }
  });
}

// Lazy (faqat kirish kerak bo'lganda yuklanadi)
const LandingPage     = lazyRetry(() => import('./components/LandingPage'));
const Dashboard       = lazyRetry(() => import('./components/Dashboard'));
const Teachers        = lazyRetry(() => import('./components/Teachers'));
const TeacherDetails  = lazyRetry(() => import('./components/TeacherDetails'));
const Courses          = lazyRetry(() => import('./components/Courses'));
const CourseDetails    = lazyRetry(() => import('./components/CourseDetails'));
const SyllabusManager  = lazyRetry(() => import('./components/SyllabusManager'));
const Students        = lazyRetry(() => import('./components/Students'));
const StudentDetails  = lazyRetry(() => import('./components/StudentDetails'));
const Leads           = lazyRetry(() => import('./components/Leads'));
const Finance         = lazyRetry(() => import('./components/Finance'));
const Settings        = lazyRetry(() => import('./components/Settings'));
const Reports         = lazyRetry(() => import('./components/Reports'));
const Logistics       = lazyRetry(() => import('./components/Logistics'));
const Messaging       = lazyRetry(() => import('./components/Messaging'));
const ExamsList       = lazyRetry(() => import('./components/ExamsList'));
const ExamBuilder     = lazyRetry(() => import('./components/ExamBuilder'));
const ExamDetail      = lazyRetry(() => import('./components/ExamDetail'));
const Scanner         = lazyRetry(() => import('./components/Scanner'));
const QuestionsList   = lazyRetry(() => import('./components/QuestionsList'));
const QuestionEditor  = lazyRetry(() => import('./components/QuestionEditor'));
const ExamResults     = lazyRetry(() => import('./components/ExamResults'));
const SuperAdmin      = lazyRetry(() => import('./components/SuperAdmin'));
const OrgDetail       = lazyRetry(() => import('./components/OrgDetail'));
const HRManagement    = lazyRetry(() => import('./components/HRManagement'));
const StaffDetails    = lazyRetry(() => import('./components/StaffDetails'));
const PublicApply     = lazyRetry(() => import('./components/PublicApply'));

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

  React.useEffect(() => {
    sessionStorage.removeItem('chunk-reload-flag');
  }, []);

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
            <Route path="/messaging"            element={isAdminOrManager ? <Messaging />  : <Navigate to="/" replace />} />
            <Route path="/reports"              element={<Navigate to="/" replace />} />
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
