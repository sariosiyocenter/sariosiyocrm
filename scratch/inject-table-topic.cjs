const fs = require('fs');

const filePath = 'c:/Users/Hp Vitus Gaming/Desktop/saraosiyo crm/src/components/StudentDetails.tsx';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// Let's find the header starting at line 800 index (799 index in 0-based array)
// Line 801 is index 800: "                                                <thead>"
// Let's check:
const startIndex = lines.findIndex(line => line.includes("<thead>") && lines[lines.indexOf(line) + 2].includes("date_group"));
if (startIndex !== -1) {
    console.log('Found the table structure at index:', startIndex);
    
    // We want to replace from index startIndex to the end of the table.
    // Let's find the closing </tbody> tag.
    const tbodyCloseIndex = lines.indexOf("                                                </tbody>", startIndex);
    if (tbodyCloseIndex !== -1) {
        console.log('Found closing tbody at index:', tbodyCloseIndex);
        
        // Let's construct the new table body lines
        const newTablePart = [
            '                                                <thead>',
            '                                                    <tr className="bg-gray-55 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50">',
            '                                                        <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">{t(\'date_group\')}</th>',
            '                                                        <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">{t(\'topic_label\')}</th>',
            '                                                        <th className="p-4 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">{t(\'status\')}</th>',
            '                                                    </tr>',
            '                                                </thead>',
            '                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">',
            '                                                    {studentAttendances.map(a => {',
            '                                                        const groupObj = groups.find(g => g.id === a.groupId);',
            '                                                        ',
            '                                                        let topicObj = a.topicId ? (topics || []).find(t => t.id === a.topicId) : null;',
            '                                                        if (!topicObj && groupObj) {',
            '                                                            const sibling = (attendances || []).find(att => att.groupId === groupObj.id && att.date === a.date && att.topicId);',
            '                                                            if (sibling && sibling.topicId) {',
            '                                                                topicObj = (topics || []).find(t => t.id === sibling.topicId) || null;',
            '                                                            }',
            '                                                        }',
            '                                                        if (!topicObj && groupObj) {',
            '                                                            const uniqueDates = Array.from(new Set(',
            '                                                                attendances',
            '                                                                    .filter(att => att.groupId === groupObj.id)',
            '                                                                    .map(att => att.date)',
            '                                                            )).sort();',
            '                                                            const dateIndex = uniqueDates.indexOf(a.date);',
            '                                                            if (dateIndex !== -1) {',
            '                                                                 const lessonOrder = dateIndex + 1;',
            '                                                                 topicObj = (topics || []).find(t => t.courseId === groupObj.courseId && t.order === lessonOrder) || null;',
            '                                                            }',
            '                                                        }',
            '',
            '                                                        return (',
            '                                                            <tr key={a.id} className="hover:bg-gray-50/30 transition-colors">',
            '                                                                <td className="p-4">',
            '                                                                    <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">{a.date}</p>',
            '                                                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{groupObj?.name || \'-\'}</p>',
            '                                                                </td>',
            '                                                                <td className="p-4">',
            '                                                                    {topicObj ? (',
            '                                                                        <div>',
            '                                                                            <p className="text-[10px] font-black text-[#1b6b6b] uppercase tracking-wider">{topicObj.order}. {topicObj.title}</p>',
            '                                                                            {topicObj.description && (',
            '                                                                                <p className="text-[8px] font-medium text-gray-400 uppercase mt-0.5 truncate max-w-[200px]" title={topicObj.description}>{topicObj.description}</p>',
            '                                                                            )}',
            '                                                                        </div>',
            '                                                                    ) : (',
            '                                                                        <p className="text-[9px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-wider italic">-</p>',
            '                                                                    )}',
            '                                                                </td>',
            '                                                                <td className="p-4">',
            '                                                                    <div className="flex justify-center">',
            '                                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider ${a.status === \'Keldi\' ? \'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400\' : \'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-450\'}`}>',
            '                                                                            {a.status === \'Keldi\' ? t(\'present\') : a.status === \'Kelmapdi\' ? t(\'absent\') : a.status === \'Sababli\' ? t(\'reason\') : a.status}',
            '                                                                        </span>',
            '                                                                    </div>',
            '                                                                </td>',
            '                                                            </tr>',
            '                                                        );',
            '                                                    })}',
            '                                                </tbody>'
        ];
        
        // Splice the new array in place of the old table section
        lines.splice(startIndex, tbodyCloseIndex - startIndex + 1, ...newTablePart);
        
        // Write the lines back to file
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        console.log('Successfully updated file!');
    } else {
        console.log('Error: Could not find closing tbody tag.');
    }
} else {
    console.log('Error: Could not find table structure starts.');
}
