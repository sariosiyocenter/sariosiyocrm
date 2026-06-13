const fs = require('fs');

const filePath = 'c:/Users/Hp Vitus Gaming/Desktop/saraosiyo crm/src/components/StudentDetails.tsx';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// Find indices first on the clean array
// 1. Missed Topics Card section
const startIdx = lines.findIndex(l => l.trim() === '{/* Qolib ketgan mavzular (Missed Topics) */}');

let endIdx = -1;
if (startIdx !== -1) {
    const calendarHeaderLabelIdx = lines.findIndex(l => l.includes('attendance_calendar'));
    if (calendarHeaderLabelIdx !== -1) {
        // Scan upwards from calendarHeaderLabelIdx to find the start of the calendar header block
        let calendarHeaderStartIdx = -1;
        for (let i = calendarHeaderLabelIdx; i >= 0; i--) {
            if (lines[i].includes('rounded-2xl') && lines[i].includes('flex flex-col sm:flex-row')) {
                calendarHeaderStartIdx = i;
                break;
            }
        }
        if (calendarHeaderStartIdx !== -1) {
            endIdx = calendarHeaderStartIdx - 1;
        }
    }
}

// 2. StudentAttendances map and topic cell bounds
const mapIdx = lines.findIndex(l => l.trim().startsWith('{studentAttendances.map(a =>'));
let topicCellIdx = -1;
let topicCellEndIdx = -1;

if (mapIdx !== -1) {
    topicCellIdx = lines.findIndex((l, i) => i > mapIdx && l.trim().startsWith('{topicObj ? ('));
    if (topicCellIdx !== -1) {
        // Find closing cell tag
        topicCellEndIdx = lines.findIndex((l, i) => i > topicCellIdx && l.trim() === '</td>');
    }
}

console.log('Indices found:');
console.log(`- Card section: lines ${startIdx + 1} to ${endIdx + 1}`);
console.log(`- Map loop index: line ${mapIdx + 1}`);
console.log(`- Topic cell bounds: lines ${topicCellIdx + 1} to ${topicCellEndIdx + 1}`);

if (startIdx === -1 || endIdx === -1 || mapIdx === -1 || topicCellIdx === -1 || topicCellEndIdx === -1) {
    console.log('Error: One or more indices could not be resolved. Aborting.');
    process.exit(1);
}

// Perform replacements from bottom-to-top (largest index first)
// 1. Topic cell replacement
const newTopicCellLines = [
    '                                                                    {topicObj ? (',
    '                                                                        <div>',
    '                                                                            <p className="text-[10px] font-black text-[#1b6b6b] uppercase tracking-wider">{topicObj.order}. {topicObj.title}</p>',
    '                                                                            {topicObj.description && (',
    '                                                                                <p className="text-[8px] font-medium text-gray-400 uppercase mt-0.5 truncate max-w-[200px]" title={topicObj.description}>{topicObj.description}</p>',
    '                                                                            )}',
    '                                                                            {a.status === \'Kelmapdi\' && (',
    '                                                                                <button ',
    '                                                                                    onClick={async () => {',
    '                                                                                        try {',
    '                                                                                            await updateAttendance(a.id, { caughtUp: !a.caughtUp });',
    '                                                                                        } catch (err) {',
    '                                                                                            console.error("Failed to update caughtUp status", err);',
    '                                                                                        }',
    '                                                                                    }}',
    '                                                                                    className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all border cursor-pointer ${',
    '                                                                                        a.caughtUp ',
    '                                                                                            ? \'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40\' ',
    '                                                                                            : \'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40\'',
    '                                                                                    }`}',
    '                                                                                >',
    '                                                                                    {a.caughtUp ? t(\'topic_caught_up\') : t(\'topic_not_caught_up\')}',
    '                                                                                </button>',
    '                                                                            )}',
    '                                                                        </div>',
    '                                                                    ) : (',
    '                                                                        <div>',
    '                                                                            <p className="text-[9px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-wider italic">-</p>',
    '                                                                            {a.status === \'Kelmapdi\' && (',
    '                                                                                <button ',
    '                                                                                    onClick={async () => {',
    '                                                                                        try {',
    '                                                                                            await updateAttendance(a.id, { caughtUp: !a.caughtUp });',
    '                                                                                        } catch (err) {',
    '                                                                                            console.error("Failed to update caughtUp status", err);',
    '                                                                                        }',
    '                                                                                    }}',
    '                                                                                    className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all border cursor-pointer ${',
    '                                                                                        a.caughtUp ',
    '                                                                                            ? \'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40\' ',
    '                                                                                            : \'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40\'',
    '                                                                                    }`}',
    '                                                                                >',
    '                                                                                    {a.caughtUp ? t(\'topic_caught_up\') : t(\'topic_not_caught_up\')}',
    '                                                                                </button>',
    '                                                                            )}',
    '                                                                        </div>',
    '                                                                    )}'
];

lines.splice(topicCellIdx, topicCellEndIdx - topicCellIdx, ...newTopicCellLines);

// 2. Card section removal
lines.splice(startIdx, endIdx - startIdx + 1);

// Write back to file
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Successfully completed merge modifications!');
