// Rangli chizma (egasi, 2026-10-25: «rangliroq, chiroyliroq — monoxrom emas»): tozalagich rangni
// saqlaydi, lekin oq-qora printerda ham o'qilsin — chiziq va yozuv rangi yetarlicha to'q bo'ladi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svgniTozala } from '../lib/svgTozala.js';

const tozala = (ichi) => svgniTozala(`<svg viewBox="0 0 200 120">${ichi}</svg>`).svg;
const yoruglik = (hex) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

test('palitra ranglari (chiziq, och soya, yozuv) o\'zgarmaydi', () => {
  const svg = tozala('<polygon points="20,100 180,100 20,20" fill="#dbeafe" stroke="#1e293b"/><line x1="20" y1="100" x2="180" y2="100" stroke="#1d4ed8"/><line x1="20" y1="20" x2="180" y2="100" stroke="#dc2626"/><text x="100" y="115" font-size="14" fill="#15803d">8 sm</text>');
  for (const r of ['fill="#dbeafe"', 'stroke="#1e293b"', 'stroke="#1d4ed8"', 'stroke="#dc2626"', 'fill="#15803d"']) assert.ok(svg.includes(r), `${r}\n${svg}`);
});

test('och rangli chiziq va yozuv tusi saqlanib to\'qlashtiriladi (oq-qora chopda ko\'rinsin)', () => {
  const svg = tozala('<line x1="10" y1="10" x2="190" y2="10" stroke="yellow"/><text x="20" y="60" font-size="14" fill="#fde68a">A</text>');
  const chiziq = /<line[^>]* stroke="(#[0-9a-f]{6})"/.exec(svg)[1];
  const yozuv = /<text[^>]* fill="(#[0-9a-f]{6})"/.exec(svg)[1];
  for (const r of [chiziq, yozuv]) {
    assert.ok(yoruglik(r) <= 140, `${r} juda och`);
    // Tusi qoladi: qizil va yashil kanal ko'kdan baland (sariq).
    const [q, y, k] = [1, 3, 5].map(i => parseInt(r.slice(i, i + 2), 16));
    assert.ok(q > k && y > k, r);
  }
});

test('kulrang avvalgidek: och chiziq 153 gacha, deyarli oq — oq', () => {
  const svg = tozala('<line x1="10" y1="10" x2="190" y2="10" stroke="#eeeeee"/><line x1="10" y1="30" x2="190" y2="30" stroke="#cccccc"/><line x1="10" y1="50" x2="190" y2="50" stroke="#000"/>');
  assert.match(svg, /y1="10"[^>]* stroke="#ffffff"/);
  assert.match(svg, /y1="30"[^>]* stroke="#999999"/);
  assert.match(svg, /y1="50"[^>]* stroke="#000000"/);
});

test('hsl rang haqiqiy tusiga o\'giriladi', () => {
  const svg = tozala('<circle cx="60" cy="60" r="20" fill="hsl(210, 80%, 90%)" stroke="hsl(140,60%,30%)"/>');
  assert.match(svg, /fill="#d1e6fa"/);
  assert.match(svg, /stroke="#1f7a3d"/);
});

test('noma\'lum rang nomi — qora', () => {
  assert.match(tozala('<line x1="10" y1="10" x2="190" y2="10" stroke="qizilcha"/>'), /stroke="#000000"/);
});

test('rangli chizma qayta tozalanganda o\'zgarmaydi', () => {
  const bir = svgniTozala('<svg viewBox="0 0 200 120"><line x1="10" y1="10" x2="190" y2="10" stroke="gold"/><circle cx="60" cy="60" r="20" fill="#ffedd5" stroke="#c2410c"/><text x="100" y="100" font-size="14" fill="lightcoral">x</text></svg>').svg;
  assert.equal(svgniTozala(bir).svg, bir);
});
