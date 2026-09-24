/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useCRM } from './context/CRMContext';
import { MODULLAR } from '../lib/ruxsatlar.js';

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
const TeacherDetails  = lazyRetry(() => import('./components/TeacherDetails'));
const Courses          = lazyRetry(() => import('./components/Courses'));
const CourseDetails    = lazyRetry(() => import('./components/CourseDetails'));
const SyllabusManager  = lazyRetry(() => import('./components/SyllabusManager'));
const Students        = lazyRetry(() => import('./components/Students'));
const StudentDetails  = lazyRetry(() => import('./components/StudentDetails'));
const Leads           = lazyRetry(() => import('./components/Leads'));
const Finance         = lazyRetry(() => import('./components/Finance'));
const Settings        = lazyRetry(() => import('./components/Settings'));
const Logistics       = lazyRetry(() => import('./components/Logistics'));
const Messaging       = lazyRetry(() => import('./components/Messaging'));
const ExamsList       = lazyRetry(() => import('./components/ExamsList'));
const ExamBuilder     = lazyRetry(() => import('./components/ExamBuilder'));
const ExamDetail      = lazyRetry(() => import('./components/ExamDetail'));
const QuestionsList   = lazyRetry(() => import('./components/QuestionsList'));
const QuestionEditor  = lazyRetry(() => import('./components/QuestionEditor'));
const ExamResults     = lazyRetry(() => import('./components/ExamResults'));
const SuperAdmin      = lazyRetry(() => import('./components/SuperAdmin'));
const OrgDetail       = lazyRetry(() => import('./components/OrgDetail'));
const HRManagement    = lazyRetry(() => import('./components/HRManagement'));
const StaffDetails    = lazyRetry(() => import('./components/StaffDetails'));
const PublicApply     = lazyRetry(() => import('./components/PublicApply'));
const DailySheet      = lazyRetry(() => import('./components/DailySheet'));
const AuditLog        = lazyRetry(() => import('./components/AuditLog'));
const PublicPay       = lazyRetry(() => import('./components/PublicPay'));
const NatijaSahifasi  = lazyRetry(() => import('./components/NatijaSahifasi'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-ichki flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-brand border-t-transparent rounded-full animate-spin" />
        <p className="text-[14px] text-matn-sokin font-medium">Yuklanmoqda...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, logout, loading, token, error, checkAuth, modulKorinadi, kora, ozgartira } = useCRM();

  React.useEffect(() => {
    sessionStorage.removeItem('chunk-reload-flag');
  }, []);

  const isApplyRoute = window.location.pathname.startsWith('/apply');
  // Payme to'lovidan keyin qaytish sahifasi — kirishsiz, faqat buyurtma holati.
  const isPayRoute = window.location.pathname.startsWith('/pay/');
  // Imtihon natijasi — ota-onaga xabardagi imzolangan havola (kirishsiz).
  const isNatijaRoute = window.location.pathname.startsWith('/natija/');

  // Ochiq sahifalar sessiya yuklanishini kutmaydi: ota-ona Payme'dan qaytganda
  // (brauzerida CRM tokeni bo'lsa ham) darhol natijani ko'rsin.
  if (isApplyRoute || isPayRoute || isNatijaRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/apply/:schoolId" element={<PublicApply />} />
          <Route path="/pay/:orderId" element={<PublicPay />} />
          <Route path="/natija/:token" element={<NatijaSahifasi />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (loading) {
    return <PageLoader />;
  }

  // Sessiya bor, lekin server javob bermadi. Ilgari bunday holatda foydalanuvchi
  // tizimdan chiqarilib, reklama sahifasiga tushib qolardi — go'yo u chiqib ketgandek.
  // Endi token saqlanadi va faqat qayta urinish taklif qilinadi.
  if (!user && token && error) {
    return (
      <div className="min-h-screen bg-ichki flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-sirt border border-chiziq rounded-2xl p-8 text-center space-y-4">
          <h1 className="text-sm font-black text-matn tracking-tight">Serverga ulanib bo'lmadi</h1>
          <p className="text-[12px] text-matn-xira font-medium">{error}</p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => checkAuth()}
              className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white rounded-xl text-[11px] font-extrabold transition-all cursor-pointer"
            >
              Qayta urinish
            </button>
            <button
              onClick={logout}
              className="flex-1 py-3 bg-chiziq text-matn rounded-xl text-[11px] font-extrabold transition-all cursor-pointer"
            >
              Chiqish
            </button>
          </div>
        </div>
      </div>
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

  // Sahifa lavozim ruxsatiga qarab ochiladi (Sozlamalar → Ruxsatlar). Yopiq
  // sahifa manzilini qo'lda yozgan xodim birinchi ochiq sahifasiga qaytadi.
  // Bosh sahifa yopiq bo'lsa ham "/" bo'sh qolmaydi.
  const birinchiSahifa = MODULLAR.find(m => modulKorinadi(m.id))?.yol || '/settings';
  const yopiq = <Navigate to={birinchiSahifa} replace />;
  // "/" ning o'zi yopiq bo'lsa — bosh sahifadan boshqa birinchi ochiq sahifa.
  const boshYopiq = <Navigate to={MODULLAR.find(m => m.id !== 'bosh' && modulKorinadi(m.id))?.yol || '/settings'} replace />;
  const sahifa = (ochiq: boolean, el: React.ReactNode) => (ochiq ? el : yopiq);
  const m = modulKorinadi;

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
            <Route path="/"                     element={m('bosh') ? <Dashboard /> : boshYopiq} />
            <Route path="/leads"                element={sahifa(m('lidlar'), <Leads />)} />
            <Route path="/teachers/:id"         element={sahifa(kora('xodimlar.royxat'), <TeacherDetails />)} />
            <Route path="/courses"               element={sahifa(m('kurslar'), <Courses />)} />
            <Route path="/courses/:id"           element={sahifa(m('kurslar'), <CourseDetails />)} />
            <Route path="/syllabus"             element={sahifa(m('dastur'), <SyllabusManager />)} />
            <Route path="/students"             element={sahifa(kora('oquvchilar.royxat'), <Students />)} />
            <Route path="/students/:id"         element={sahifa(kora('oquvchilar.royxat'), <StudentDetails />)} />
            <Route path="/daily"                element={sahifa(m('kunlik'), <DailySheet />)} />
            <Route path="/journal"              element={sahifa(m('jurnal'), <AuditLog />)} />
            <Route path="/hr"                   element={sahifa(kora('xodimlar.royxat'), <HRManagement />)} />
            <Route path="/hr/:id"              element={sahifa(kora('xodimlar.royxat'), <StaffDetails />)} />
            <Route path="/settings"             element={<Settings />} />
            <Route path="/finance"              element={sahifa(m('moliya'), <Finance />)} />
            <Route path="/logistics"            element={sahifa(m('logistika'), <Logistics />)} />
            <Route path="/messaging"            element={sahifa(m('xabarlar'), <Messaging />)} />
            <Route path="/reports"              element={<Navigate to="/" replace />} />
            <Route path="/exams"                element={sahifa(m('imtihonlar'), <ExamsList />)} />
            <Route path="/exams/new"            element={sahifa(ozgartira('imtihonlar.imtihon'), <ExamBuilder />)} />
            <Route path="/exams/:id/edit"       element={sahifa(ozgartira('imtihonlar.imtihon'), <ExamBuilder />)} />
            <Route path="/exams/:id"            element={sahifa(kora('imtihonlar.imtihon') || kora('imtihonlar.natija'), <ExamDetail />)} />
            <Route path="/scanner"              element={<Navigate to="/exams" replace />} />
            <Route path="/questions"            element={<Navigate to="/exams?tab=savollar" replace />} />
            <Route path="/questions/new"        element={sahifa(ozgartira('imtihonlar.savollar'), <QuestionEditor />)} />
            <Route path="/questions/:id/edit"   element={sahifa(kora('imtihonlar.savollar'), <QuestionEditor />)} />
            <Route path="/exam-results"         element={sahifa(kora('imtihonlar.natija'), <ExamResults />)} />
            <Route path="*"                     element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Suspense>
    </Layout>
  );
}
