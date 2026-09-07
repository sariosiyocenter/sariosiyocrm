import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';

/**
 * Eski "o'qituvchi profili" manzili.
 *
 * Bir odam uchun ikkita profil bor edi: bu sahifa va xodim kartasi (/hr/:id).
 * Ikkalasi butunlay boshqacha ko'rinar, bu yerda esa na oylik berish, na
 * davomat, na Telegram xabari bor edi — chunki ularning hammasi xodim
 * yozuviga (User) bog'langan. Endi yagona profil xodim kartasi bo'ldi,
 * bu manzil esa faqat eski havolalarni o'shanga olib boradi.
 */
export default function TeacherDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { teachers, loading } = useCRM();

    const teacher = teachers.find(t => t.id === Number(id));

    useEffect(() => {
        if (!teacher) return;
        // userId serverda avtomatik to'ldiriladi; kutilmaganda bo'sh bo'lsa
        // xodimlar ro'yxatiga qaytamiz — bo'sh sahifada qoldirmaymiz.
        navigate(teacher.userId ? `/hr/${teacher.userId}` : '/hr', { replace: true });
    }, [teacher?.id, teacher?.userId]);

    if (loading || (!teacher && teachers.length === 0)) {
        return <div className="py-20 text-center text-brand text-xs font-bold">Yuklanmoqda...</div>;
    }
    if (!teacher) {
        return (
            <div className="p-12 text-center text-matn-xira font-bold text-sm bg-sirt rounded-2xl border border-chiziq shadow-sm">
                O'qituvchi topilmadi
            </div>
        );
    }
    return <div className="py-20 text-center text-brand text-xs font-bold">Profilga o'tilmoqda...</div>;
}
