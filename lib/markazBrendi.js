import prisma from './prisma.js';

// Filialning o'z sozlamasi (Setting) hali yo'q bo'lsa — masalan, keyin ochilgan
// Langar filiali — sarlavhadagi markaz nomi va logotipi shu markazning boshqa
// filiali sozlamasidan olinadi, u ham bo'lmasa tashkilot nomidan. Avval bu yerda
// qat'iy "QUANTUM EDU" turardi va Langarda begona nom chiqardi.
export async function markazBrendi(schoolId) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, organizationId: true, organization: { select: { name: true } } },
  });
  if (!school) return { orgName: '', logo: null };
  const qoshni = school.organizationId
    ? await prisma.setting.findFirst({
        where: { school: { organizationId: school.organizationId } },
        orderBy: { id: 'asc' },
        select: { orgName: true, logo: true },
      })
    : null;
  return {
    orgName: qoshni?.orgName || school.organization?.name || school.name,
    logo: qoshni?.logo || null,
  };
}
