// Xabar shabloni: matndagi o'zgaruvchilarni to'ldirish.
//
// Alohida faylda — server.js dagi yuzlab yo'llar orasida emas, shu bilan
// sof funksiya sifatida sinaladi (scratch/test_xabar_ozgaruvchi.mjs).

// Shablon o'zgaruvchilari:
//   {ism} {qarz} {balans} {kurs} {fan} {ustoz} {markaz} {testnatijasi}
//   {imtihon_nomi} {imtihon_ball} {imtihon_foiz} {to_lov_summa} {bahosi}
//
// {guruh} — {kurs} ning eski nomi. Egasi (2026-09-23) "guruh" so'zini
// ishlatmaydi, lekin bazada shu o'zgaruvchi bilan yozilgan shablonlar bor,
// shuning uchun ikkalasi ham ishlaydi.
export function fillTemplate(body, student, groupsForStudent, school) {
  const balance = Number(student.balance || 0);
  const debt = balance < 0 ? Math.abs(balance) : 0;
  const guruhlar = groupsForStudent || [];
  const groupNames = guruhlar.map(g => g.name).filter(Boolean).join(', ');
  const fanNomlari = [...new Set(guruhlar.map(g => g.courseName).filter(Boolean))].join(', ');
  const ustozNomlari = [...new Set(guruhlar.map(g => g.teacherName).filter(Boolean))].join(', ');

  // Custom trigger properties
  const examName = student.customExamName || '';
  const examScore = student.customExamScore !== undefined ? String(student.customExamScore) : '';
  const examPercentage = student.customExamPercentage !== undefined ? `${student.customExamPercentage}%` : '';
  const paymentAmount = student.customPaymentAmount !== undefined ? student.customPaymentAmount.toLocaleString() : '';
  const dailyScore = student.customDailyScore !== undefined ? String(student.customDailyScore) : '';

  // {testnatijasi} — oxirgi imtihon natijasi ("Sinov-3: 42 ball (70%)").
  // Imtihon tetigi bo'lsa o'sha imtihonniki, aks holda eng oxirgisi
  // (`student.lastExam`, xabar yuborishdan oldin to'planadi).
  const oxirgi = student.lastExam;
  const testNatijasi = (examScore || examPercentage)
    ? [examName, examScore ? `${examScore} ball` : '', examPercentage].filter(Boolean).join(' · ')
    : oxirgi
      ? [oxirgi.name, oxirgi.score !== undefined ? `${oxirgi.score} ball` : '', oxirgi.percentage !== undefined ? `${Math.round(oxirgi.percentage)}%` : ''].filter(Boolean).join(' · ')
      : '';

  return String(body || '')
    .replace(/\{ism\}/gi, student.name || '')
    .replace(/@name/gi, student.name || '')
    .replace(/\{qarz\}/gi, debt.toLocaleString())
    .replace(/\{balans\}/gi, balance.toLocaleString())
    .replace(/\{kurs\}/gi, groupNames)
    .replace(/\{guruh\}/gi, groupNames)
    .replace(/\{fan\}/gi, fanNomlari)
    .replace(/\{ustoz\}/gi, ustozNomlari)
    .replace(/\{testnatijasi\}/gi, testNatijasi)
    .replace(/\{markaz\}/gi, school?.name || '')
    .replace(/\{imtihon_nomi\}/gi, examName)
    .replace(/\{imtihon_ball\}/gi, examScore)
    .replace(/\{imtihon_foiz\}/gi, examPercentage)
    .replace(/\{to_lov_summa\}/gi, paymentAmount)
    .replace(/\{bahosi\}/gi, dailyScore);
}

/** Matnda {testnatijasi} bormi. */
export const testNatijasiKerak = (body) => /\{testnatijasi\}/i.test(String(body || ''));
