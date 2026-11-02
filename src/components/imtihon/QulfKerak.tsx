import React from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Karta, Tugma, BoshHolat } from './ui';

/** Bosqich savollar qulflanmaguncha ishlamaydi — sababi va "Imtihonlar" tabiga yo'l. */
export default function QulfKerak({ examId, ikonka, izoh, qoshimcha }: { examId: number; ikonka: React.ReactNode; izoh: string; qoshimcha?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <Karta>
      <BoshHolat ikonka={ikonka} sarlavha="Avval savollarni qulflang" izoh={izoh}>
        <Tugma turi="asosiy" kichik ikonka={<Lock size={13} />} onClick={() => navigate(`/exams?tab=imtihonlar&imtihon=${examId}&b=qogoz`)}>Savol qog'ozi → tasdiqlash</Tugma>
        {qoshimcha}
      </BoshHolat>
    </Karta>
  );
}
