/**
 * To'lov cheki — chop etish uchun yagona joy.
 *
 * Ilgari ikkita alohida amalga oshirish bor edi va ikkalasi ham oq varaq chiqarardi:
 *
 *  - Moliya sahifasi popup ochib, 400 ms dan keyin `print()` chaqirib, darhol
 *    `close()` qilardi. Chrome'da chop etish muloqoti asinxron — oyna yopilgach
 *    hech narsa qolmasdi, logotip esa umuman yuklanib ulgurmasdi.
 *  - O'quvchi sahifasi `@media print { body > * { display: none } }` ishlatardi va
 *    chekni ko'rsatishga urinardi. Lekin chek o'sha yashirilgan `#root` ichida
 *    joylashgan: ota element `display:none` bo'lsa, boladagi `display:block`
 *    yordam bermaydi — varaq butunlay bo'sh chiqardi.
 *
 * Endi chek alohida oynada tayyor HTML sifatida ochiladi, rasmlar yuklanishi
 * kutiladi, so'ng chop etiladi va oyna chop etish tugagach yopiladi.
 */

export interface ReceiptPayment {
    id: number | string;
    date: string;
    type: string;
    amount: number;
}

export interface ReceiptStudent {
    name?: string;
    phone?: string;
    balance?: number;
}

export interface ReceiptOptions {
    payment: ReceiptPayment;
    student?: ReceiptStudent | null;
    /** Markaz nomi (Sozlamalardagi orgName). */
    orgName?: string | null;
    /** Markaz logotipi — URL yoki data URL. */
    logo?: string | null;
    /** Chek pastidagi qo'shimcha satrlar: manzil, telefon. */
    address?: string | null;
    adminPhone?: string | null;
    /** To'lov qaysi kurs uchun ekani. */
    courseName?: string | null;
    /** O'quvchi a'zo bo'lgan guruhlar: "Matematika A (Matematika)". */
    groupLines?: string[];
}

const esc = (value: unknown) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const money = (n: number) => Number(n || 0).toLocaleString('ru-RU');

function receiptHtml(o: ReceiptOptions): string {
    const { payment, student } = o;
    const balance = student?.balance ?? 0;
    const groupLines = (o.groupLines || []).filter(Boolean);

    const footerLines = [o.address, o.adminPhone].filter(Boolean).map(esc).join(' &middot; ');

    return `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"><title>Chek #${esc(payment.id)}</title>
<style>
  /* A4 varaq solinadi, chek uning yuqori yarmiga — ya'ni A5 maydoniga —
     bosiladi. Pastda kesish chizig'i turadi, varaq shu joydan qirqiladi.
     A4 = 210x297mm, yarmi = 210x148.5mm. */
  @page { size: A4 portrait; margin: 0; }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #111; background: #fff; }
  .sheet {
    width: 210mm;
    min-height: 148.5mm;
    padding: 10mm 12mm 6mm;
    margin: 0 auto;
    position: relative;
  }
  .logo { display: block; margin: 0 auto 6px; max-width: 64px; max-height: 64px; object-fit: contain; }
  h2 { font-size: 15px; font-weight: 900; text-align: center; letter-spacing: 2px; color: #1b6b6b; margin-bottom: 4px; }
  .sub { text-align: center; font-size: 9px; letter-spacing: 2px; color: #888; margin-bottom: 10px; }
  .box { border: 1px dashed #ccc; border-radius: 8px; padding: 12px 16px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 5px; gap: 12px; }
  .row .val { font-weight: 900; text-align: right; }
  .divider { border-top: 1px dashed #ccc; margin: 9px 0; }
  .label { font-size: 9px; color: #888; display: block; margin-bottom: 2px; }
  .big { font-size: 14px; font-weight: 900; }
  .green { color: #059669; }
  .red { color: #e11d48; }
  .footer { margin-top: 10px; text-align: center; font-size: 9px; letter-spacing: 1px; color: #aaa; }
  /* Kesish chizig'i — A4 ning aynan o'rtasi. */
  .cut {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    border-top: 1px dashed #bbb;
    text-align: center;
  }
  .cut span { font-size: 8px; color: #bbb; letter-spacing: 1px; background: #fff; padding: 0 6px; position: relative; top: -6px; }
  @media screen {
    body { background: #f1f5f9; padding: 16px 0; }
    .sheet { background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
  }
  @media print {
    /* Rangli sarlavha va logotip printerda ham chiqsin. */
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
<div class="sheet">
${o.logo ? `<img class="logo" src="${esc(o.logo)}" alt="">` : ''}
<h2>${esc(o.orgName || 'O\'QUV MARKAZI')}</h2>
<div class="sub">To'lov cheki (Receipt)</div>
<div class="box">
  <div class="row"><span>Chek #</span><span class="val">#${esc(payment.id)}</span></div>
  <div class="row"><span>Sana:</span><span class="val">${esc(payment.date)}</span></div>
  <div class="divider"></div>
  <div style="margin-bottom:10px"><span class="label">O'quvchi:</span><div class="big">${esc(student?.name || '')}</div></div>
  ${student?.phone ? `<div style="margin-bottom:10px"><span class="label">Telefon:</span><div>${esc(student.phone)}</div></div>` : ''}
  ${o.courseName ? `<div style="margin-bottom:10px"><span class="label">Kurs uchun:</span><div class="big">${esc(o.courseName)}</div></div>` : ''}
  ${groupLines.length ? `<div style="margin-bottom:10px"><span class="label">Guruhlar:</span>${groupLines.map(l => `<div>- ${esc(l)}</div>`).join('')}</div>` : ''}
  <div class="divider"></div>
  <div class="row"><span>To'lov turi:</span><span class="val">${esc(payment.type)}</span></div>
  <div class="row" style="font-size:15px">
    <span style="color:#1b6b6b;font-weight:700">To'landi:</span>
    <span class="val green">+${money(payment.amount)} UZS</span>
  </div>
  <div class="row">
    <span>Joriy balans:</span>
    <span class="val ${balance >= 0 ? 'green' : 'red'}">${money(balance)} UZS</span>
  </div>
  <div class="divider"></div>
  <div class="footer">To'lovingiz uchun rahmat!${footerLines ? `<br>${footerLines}` : ''}</div>
</div>
<div class="cut"><span>&#9986; shu chiziq bo'yicha qirqing</span></div>
</div>
</body></html>`;
}

/** Chekni alohida oynada ochadi va chop etish muloqotini chiqaradi. */
export function printReceipt(options: ReceiptOptions): void {
    const popup = window.open('', '_blank', 'width=860,height=700');
    if (!popup) {
        alert("Chekni chop etish uchun brauzerda pop-up oynalarga ruxsat bering.");
        return;
    }

    popup.document.open();
    popup.document.write(receiptHtml(options));
    popup.document.close();

    let printed = false;
    const print = () => {
        if (printed || popup.closed) return;
        printed = true;
        // Chop etish tugagach oynani yopamiz. Ilgari oyna darhol yopilar edi va
        // muloqotga hech narsa yetib bormasdi.
        popup.onafterprint = () => popup.close();
        popup.focus();
        popup.print();
    };

    // Rasm (logotip) yuklanmagan bo'lsa chek ustki qismisiz chop etiladi,
    // shuning uchun yuklanishini kutamiz — lekin cheksiz emas.
    const waitForImages = () => {
        const images = Array.from(popup.document.images || []);
        const pending = images.filter(img => !img.complete);
        if (pending.length === 0) { print(); return; }
        let left = pending.length;
        const done = () => { if (--left <= 0) print(); };
        pending.forEach(img => {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
        });
        // Sekin internet chekni butunlay to'sib qo'ymasin.
        setTimeout(print, 3000);
    };

    if (popup.document.readyState === 'complete') {
        waitForImages();
    } else {
        popup.addEventListener('load', waitForImages, { once: true });
        setTimeout(waitForImages, 1000);
    }
}
