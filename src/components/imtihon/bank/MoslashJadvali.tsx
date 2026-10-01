import React from 'react';
import { formulaliHtml } from '../../../lib/matn';
import { MOSLASH_QATOR, MOSLASH_USTUN, moslashQatorlari } from '../../../../lib/imtihon.js';

/**
 * Moslashtirish (matritsa) savolining ko'rinishi: chap ustun A–D, o'ng ustun P–T
 * va (berilsa) javob to'ri — har qatorda qaysi o'ng bandlar to'g'ri.
 */
export default function MoslashJadvali({ chap, ong, kalit, javob, ixcham }: {
  chap: string[]; ong: string[];
  /** To'g'ri javob "PQ|R|S|T" — berilmasa to'r ko'rsatilmaydi. */
  kalit?: string | null;
  /** O'quvchi javobi (natijada) — to'g'ri kalit bilan birga ko'rsatiladi. */
  javob?: string | null;
  ixcham?: boolean;
}) {
  const k = kalit != null ? moslashQatorlari(kalit) : null;
  const j = javob != null ? moslashQatorlari(javob) : null;
  const matn = ixcham ? 'text-[12px]' : 'text-[13px]';
  // "Faqat kalit" imtihonida bandlar matni yo'q — faqat to'r.
  const matnli = [...chap, ...ong].some(x => String(x || '').trim());
  return (
    <div className="space-y-2">
      {matnli && <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <ol className="space-y-1">
          {chap.map((o, i) => (
            <li key={i} className={`flex gap-2 rounded-lg border border-chiziq bg-sirt px-3 py-1.5 ${matn} text-matn`}>
              <b>{MOSLASH_QATOR[i]})</b><span dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} />
            </li>
          ))}
        </ol>
        <ol className="space-y-1">
          {ong.map((o, i) => (
            <li key={i} className={`flex gap-2 rounded-lg border border-chiziq bg-sirt px-3 py-1.5 ${matn} text-matn`}>
              <b>{MOSLASH_USTUN[i]})</b><span dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} />
            </li>
          ))}
        </ol>
      </div>}
      {(k || j) && (
        <table className="text-[12px] border-collapse" aria-label="Moslashtirish javobi">
          <thead>
            <tr>
              <th className="w-7" />
              {ong.map((_, c) => <th key={c} className="w-7 text-center font-bold text-matn-sokin">{MOSLASH_USTUN[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {chap.map((_, r) => (
              <tr key={r}>
                <th className="text-center font-bold text-matn-sokin">{MOSLASH_QATOR[r]}</th>
                {ong.map((_, c) => {
                  const h = MOSLASH_USTUN[c];
                  const togri = !!k?.[r]?.includes(h);
                  const belgi = !!j?.[r]?.includes(h);
                  const rang = j
                    ? belgi && togri ? 'bg-yaxshi border-yaxshi' : belgi ? 'bg-xato border-xato' : togri ? 'border-yaxshi border-2' : 'border-chiziq-kuchli'
                    : togri ? 'bg-yaxshi border-yaxshi' : 'border-chiziq-kuchli';
                  return (
                    <td key={c} className="p-0.5 text-center">
                      <span className={`inline-block w-4.5 h-4.5 rounded-full border align-middle ${rang}`} title={`${MOSLASH_QATOR[r]}–${h}`} />
                    </td>
                  );
                })}
                {k && <td className="pl-2 text-matn-sokin raqam">{k[r] || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
