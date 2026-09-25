import React from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Karta, Tugma, BoshHolat } from './ui';

/** Bosqich savollar qulflanmaguncha ishlamaydi — sababi va "Imtihonlar" tabiga yo'l. */
export default function QulfKerak({ examId, ikonka, izoh }: { examId: number; ikonka: React.ReactNode; izoh: string }) {
  const navigate = useNavigate();
  return (
    <Karta>
      <BoshHolat ikonka={ikonka} sarlavha="Avval savollarni qulflang" izoh={izoh}>
        <Tugma turi="asosiy" kichik ikonka={<Lock size={13} />} onClick={() => navigate(`/exams?imtihon=${examId}`)}>Imtihonlar → qulflash</Tugma>
      </BoshHolat>
    </Karta>
  );
}
