// Chizmadagi ustma-ust yoki chiziq ustidagi yozuvni tozalagich o'zi suradi (lib/svgGeometriya.js
// yozuvlarniSur): avval bunday chizma AI ga qayta yuborilardi — har safar yana 15–40 soniya.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svgniTozala } from '../lib/svgTozala.js';
import { yozuvIchi, kesmaBolagi } from '../lib/svgGeometriya.js';

const BOSH = '<svg viewBox="0 0 200 120"><g stroke="#000" fill="none">';
const translate = (svg, matn) => {
  const m = new RegExp(`<text [^>]*transform="translate\\(([^ ]+) ([^)]+)\\)"[^>]*>${matn}<`).exec(svg);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

test('chiziq ustidagi yozuv yaqin bo\'sh joyga suriladi va kamchilik qolmaydi', () => {
  const r = svgniTozala(`${BOSH}<line x1="10" y1="60" x2="190" y2="60"/></g><text x="100" y="65" text-anchor="middle" font-size="14">R = 5 sm</text></svg>`);
  assert.equal(r.jiddiy, 0, JSON.stringify(r.ogohlar));
  const d = translate(r.svg, 'R = 5 sm');
  assert.ok(d, r.svg);
  // Egasidan uzoqlashmaydi: shriftning 1,6 baravaridan oshmaydi.
  assert.ok(Math.hypot(...d) <= 1.6 * 14 + 0.01, String(d));
});

test('ustma-ust yozuvlarning faqat bittasi suriladi', () => {
  const r = svgniTozala(`${BOSH}<line x1="10" y1="100" x2="190" y2="100"/></g><text x="100" y="40" text-anchor="middle" font-size="14">5 sm</text><text x="102" y="42" text-anchor="middle" font-size="14">a = 5</text></svg>`);
  assert.equal(r.jiddiy, 0, JSON.stringify(r.ogohlar));
  assert.equal((r.svg.match(/<text [^>]*transform=/g) || []).length, 1, r.svg);
});

test('joyida turgan yozuvga tegilmaydi', () => {
  const r = svgniTozala(`${BOSH}<line x1="10" y1="60" x2="190" y2="60"/></g><text x="100" y="52" text-anchor="middle" font-size="14">R = 5 sm</text></svg>`);
  assert.equal(r.jiddiy, 0);
  assert.doesNotMatch(r.svg, /transform=/);
});

test('bo\'sh joy topilmasa — yozuv joyida qoladi va kamchilik aytiladi', () => {
  // Har 3 birlikda gorizontal chiziq: atrofda yozuv sig'adigan bo'sh joy yo'q.
  const chiziqlar = Array.from({ length: 40 }, (_, i) => `<line x1="0" y1="${i * 3}" x2="200" y2="${i * 3}"/>`).join('');
  const r = svgniTozala(`${BOSH}${chiziqlar}</g><text x="100" y="65" text-anchor="middle" font-size="14">R = 5 sm</text></svg>`);
  assert.equal(r.jiddiy, 1, JSON.stringify(r.ogohlar));
  assert.match(r.ogohlar[0], /ustidan chiziq/);
  assert.doesNotMatch(r.svg, /<text [^>]*transform=/);
});

test('o\'ralgan (masshtablangan) guruhdagi yozuv ham to\'g\'ri suriladi', () => {
  // Guruh 2 baravar kattalashtirilgan: ildizdagi siljish yozuvning o'z koordinatalariga yarmi bo'lib o'tadi.
  const r = svgniTozala(`<svg viewBox="0 0 400 240"><g transform="scale(2)"><line x1="10" y1="60" x2="190" y2="60" stroke="#000"/><text x="100" y="65" text-anchor="middle" font-size="14">R = 5 sm</text></g></svg>`);
  assert.equal(r.jiddiy, 0, JSON.stringify(r.ogohlar));
  const d = translate(r.svg, 'R = 5 sm');
  assert.ok(d && Math.hypot(...d) <= 1.6 * 14 + 0.01, String(d));
  // Surilgan joyda chiziq yozuv ichidan o'tmaydi (ildiz koordinatalarida tekshiramiz).
  const eni = 8 * 14 * 0.62 * 1.08;
  const [x0, y0] = [2 * (100 + d[0]) - eni, 2 * (65 + d[1] - 14 * 0.8)];
  assert.equal(kesmaBolagi(yozuvIchi([x0, y0, x0 + 2 * eni, y0 + 28]), [20, 120], [380, 120]), null);
});

test('surilgan chizma qayta tozalanganda o\'zgarmaydi', () => {
  const bir = svgniTozala(`${BOSH}<line x1="10" y1="60" x2="190" y2="60"/></g><text x="100" y="65" text-anchor="middle" font-size="14">R = 5 sm</text></svg>`);
  const ikki = svgniTozala(bir.svg);
  assert.equal(ikki.svg, bir.svg);
});
