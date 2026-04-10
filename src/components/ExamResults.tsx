import React from 'react';

export default function ExamResults() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Natijalar</h2>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Imtihon natijalari va monitoring</p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700">
        <p className="text-gray-500">Natijalar tez orada bu yerda bo'ladi...</p>
      </div>
    </div>
  );
}
