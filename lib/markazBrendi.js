import prisma from './prisma.js';

// Markaz nomi butun markazga bitta — filialdan qat'iy nazar bir xil (egasi,
// 2026-09-24). Nom har filialning Setting qatorida turadi, shuning uchun:
//   • o'qishda — markazning eng birinchi sozlamasidagi nom olinadi, filial
//     qatoridagisi emas (Langar filialida Setting qatori umuman yo'q edi va
//     sarlavhada qat'iy "QUANTUM EDU" chiqardi);
//   • yozishda — markazNominiTarqat() yangi nomni barcha filiallarga yozadi.
// Logotip esa filialniki: o'z sozlamasi yo'q filial markaznikini oladi.
export async function markazBrendi(schoolId) {
  const id = Number(schoolId);
  const birinchi = await prisma.setting.findFirst({
    // Tashkilotsiz filial — faqat o'z qatori.
    where: { OR: [{ schoolId: id }, { school: { organization: { schools: { some: { id } } } } }] },
    orderBy: { id: 'asc' },
    select: { orgName: true, logo: true },
  });
  if (birinchi?.orgName) return { orgName: birinchi.orgName, logo: birinchi.logo || null };
  const school = await prisma.school.findUnique({
    where: { id },
    select: { name: true, organization: { select: { name: true } } },
  });
  return { orgName: school?.organization?.name || school?.name || '', logo: birinchi?.logo || null };
}

export async function markazNomi(schoolId) {
  return (await markazBrendi(schoolId)).orgName;
}

// Sozlamalarda o'zgartirilgan nom markazning barcha filiallariga yoziladi.
export async function markazNominiTarqat(schoolId, orgName) {
  const school = await prisma.school.findUnique({ where: { id: Number(schoolId) }, select: { organizationId: true } });
  if (!school?.organizationId) return;
  await prisma.setting.updateMany({
    where: { school: { organizationId: school.organizationId }, NOT: { orgName } },
    data: { orgName },
  });
}
