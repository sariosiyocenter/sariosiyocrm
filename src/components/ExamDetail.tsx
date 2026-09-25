import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

// Eski imtihon sahifasi (/exams/:id?b=...) — endi Imtihonlar modulining o'zi,
// shu imtihon tanlangan holda. Jurnal, profil va eski havolalar shu yerdan o'tadi.

const BOLIM_TABI: Record<string, string> = {
  tuzilma: '', qatnashchilar: 'orin', chop: 'chop', skaner: 'skaner', tekshirish: 'skaner', natijalar: 'natija',
};

export default function ExamDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const b = params.get('b') || 'tuzilma';
  const q = new URLSearchParams();
  const tab = BOLIM_TABI[b] ?? '';
  if (tab) q.set('tab', tab);
  if (Number(id)) q.set('imtihon', String(Number(id)));
  if (b === 'tekshirish') q.set('k', 'tekshirish');
  const qs = q.toString();
  return <Navigate to={`/exams${qs ? `?${qs}` : ''}`} replace />;
}
