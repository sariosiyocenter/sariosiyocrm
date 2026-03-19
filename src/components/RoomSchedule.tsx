import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Clock, MapPin, Calendar } from 'lucide-react';

const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

export default function RoomSchedule() {
    const { groups, rooms } = useCRM();
    const [selectedDayType, setSelectedDayType] = useState<'TOQ' | 'JUFT' | 'HAR_KUNI'>('TOQ');

    // 30-daqiqalik slotlar: 08:00 → 22:00
    const timeSlots: string[] = [];
    for (let h = 8; h <= 21; h++) {
        timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
    }

    const getOccupant = (roomId: number, time: string) => {
        return groups.find(g => {
            if (Number(g.room) !== Number(roomId)) return false;
            
            const groupDays = g.days?.toUpperCase() || '';
            const isGroupHarKuni = groupDays.includes('HAR') || groupDays.includes('EVERY');
            const isRoomHarKuni = selectedDayType === 'HAR_KUNI';

            const dayMatch = isRoomHarKuni 
                ? isGroupHarKuni 
                : (groupDays.includes(selectedDayType) || isGroupHarKuni);

            if (!dayMatch) return false;
            
            // Format: "08:00 - 10:00" or just startTime property
            const schedule = g.schedule || `${g.startTime} - ${g.endTime}`;
            if (!schedule) return false;
            
            const parts = schedule.split(' - ');
            const start = parts[0];
            const end = parts[1];
            
            if (!start || !end) return false;
            
            const slotTime = timeToMinutes(time);
            const startTime = timeToMinutes(start);
            const endTime = timeToMinutes(end);
            
            return slotTime >= startTime && slotTime < endTime;
        });
    };

    // Berilgan xona uchun qator celllarini colspan bilan hisoblash
    const buildRowCells = (roomId: number) => {
        const cells: { time: string; group: ReturnType<typeof getOccupant>; colspan: number }[] = [];
        let i = 0;
        while (i < timeSlots.length) {
            const time = timeSlots[i];
            const group = getOccupant(roomId, time);
            if (group) {
                // Dars qancha slotni egallaydi?
                const [, end] = group.schedule.split(' - ');
                const endMin = timeToMinutes(end);
                let span = 1;
                while (i + span < timeSlots.length && timeToMinutes(timeSlots[i + span]) < endMin) {
                    span++;
                }
                cells.push({ time, group, colspan: span });
                i += span;
            } else {
                cells.push({ time, group: undefined, colspan: 1 });
                i++;
            }
        }
        return cells;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Xonalar Bandligi</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Kunlik darslar jadvali</p>
                    </div>
                </div>

                <div className="flex bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                    {[
                        { id: 'TOQ', label: 'Toq kunlar' },
                        { id: 'JUFT', label: 'Juft kunlar' },
                        { id: 'HAR_KUNI', label: 'Har kuni' }
                    ].map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setSelectedDayType(type.id as any)}
                            className={`px-6 py-2.5 rounded-[1.125rem] text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                                selectedDayType === type.id
                                    ? 'bg-white dark:bg-gray-800 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                            }`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-sky-500/5 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-900 p-6 min-w-[200px] text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-left border-r border-gray-100 dark:border-gray-700">
                                    Xona nomi
                                </th>
                                {timeSlots.map(time => (
                                    <th key={time} className="p-4 min-w-[100px] text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center border-r border-gray-100 dark:border-gray-700/50 italic opacity-60">
                                        {time}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {rooms.map(room => {
                                const cells = buildRowCells(room.id);
                                return (
                                    <tr key={room.id} className="group hover:bg-gray-50/30 dark:hover:bg-sky-900/5 transition-colors">
                                        <td className="sticky left-0 z-20 bg-white dark:bg-gray-800 p-6 border-r border-gray-100 dark:border-gray-700 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 group-hover:text-sky-500 transition-colors shadow-inner">
                                                    <MapPin size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">{room.name}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{room.capacity} kishilik</p>
                                                </div>
                                            </div>
                                        </td>
                                        {cells.map(({ time, group, colspan }) => {
                                            const groupDays = group?.days?.toUpperCase() || '';
                                            const isGroupHarKuni = groupDays.includes('HAR') || groupDays.includes('EVERY');
                                            return (
                                                <td
                                                    key={time}
                                                    colSpan={colspan}
                                                    className={`p-1 border-r border-gray-100/50 dark:border-gray-700/30 min-h-[80px] align-top`}
                                                    style={{ minWidth: `${colspan * 100}px` }}
                                                >
                                                    {group ? (
                                                        <div className={`h-full min-h-[60px] p-3 rounded-2xl flex flex-col justify-center animate-in zoom-in-95 duration-500 shadow-sm border ${
                                                            isGroupHarKuni
                                                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800'
                                                                : 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-800'
                                                        }`}>
                                                        <p className="text-[10px] font-extrabold uppercase tracking-tight leading-tight mb-1 truncate">{group.name}</p>
                                                        <div className="flex items-center gap-1 opacity-70">
                                                            <Clock size={10} />
                                                            <span className="text-[8px] font-bold uppercase tabular-nums">{group.schedule}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                        <span className="text-[8px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">Bo'sh</span>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                            {rooms.length === 0 && (
                                <tr>
                                    <td colSpan={timeSlots.length + 1} className="p-20 text-center">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Xonalar mavjud emas</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
