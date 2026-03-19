import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Check } from 'lucide-react';

declare global {
  interface Window {
    L: any;
  }
}

interface MapPickerProps {
  onSelect: (latlng: string) => void;
  onClose: () => void;
  initialLocation?: string;
}

export default function MapPicker({ onSelect, onClose, initialLocation }: MapPickerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);

    useEffect(() => {
        if (!mapRef.current || !window.L) return;

        const L = window.L;
        const defaultPos: [number, number] = [38.4833, 67.9333]; // Default to Sariosiyo coordinates
        
        let initialPos = defaultPos;
        if (initialLocation && initialLocation.includes(',')) {
            const [lat, lng] = initialLocation.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) initialPos = [lat, lng];
        }

        const map = L.map(mapRef.current).setView(initialPos, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        let marker = L.marker(initialPos, { draggable: true }).addTo(map);
        setSelectedPos(initialPos);

        map.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            marker.setLatLng([lat, lng]);
            setSelectedPos([lat, lng]);
        });

        marker.on('dragend', () => {
            const { lat, lng } = marker.getLatLng();
            setSelectedPos([lat, lng]);
        });

        return () => {
            map.remove();
        };
    }, [initialLocation]);

    const handleConfirm = () => {
        if (selectedPos) {
            onSelect(`${selectedPos[0].toFixed(6)},${selectedPos[1].toFixed(6)}`);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 min-h-[500px] h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-10 py-6 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                            <MapPin className="text-sky-500" />
                            Manzilni belgilash
                        </h2>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest leading-none pt-1">Xarita orqali o'quvchi yashash joyini belgilang</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                        <X size={22} />
                    </button>
                </div>
                
                <div className="flex-1 relative">
                    <div ref={mapRef} className="absolute inset-0 z-10" />
                </div>

                <div className="p-8 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex-1 w-full">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Koordinatalar</p>
                        <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-400 tracking-wider">
                            {selectedPos ? `${selectedPos[0].toFixed(6)}, ${selectedPos[1].toFixed(6)}` : 'Belgilanmadi'}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <button onClick={onClose} className="flex-1 sm:flex-none px-8 py-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                            Bekor qilish
                        </button>
                        <button onClick={handleConfirm} className="flex-1 sm:flex-none px-12 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/20 flex items-center justify-center gap-2">
                            <Check size={18} />
                            Tasdiqlash
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
