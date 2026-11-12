/* Chạy:  node --test test/   (cần Node 18+) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const path = require('node:path');

global.pako = require(path.join(__dirname, '..', 'js', 'lib', 'pako.es5.min.js'));
const m3u = require('../js/m3u.js');
const G = require('../js/guide.js');
const epg = require('../js/epg.js');
require('../js/util.js');
const U = global.MT.util;

test('M3U: thuộc tính, tên có dấu phẩy, nhóm, #EXTGRP, BOM, epg url', () => {
  const text = '﻿#EXTM3U url-tvg="http://e.example/epg.xml.gz,http://other"\r\n' +
    '#EXTINF:-1 tvg-id="VTV1.vn" tvg-logo="http://l/1.png" group-title="Quốc gia",VTV1 HD\r\n' +
    '#EXTVLCOPT:http-user-agent=x\r\n' +
    'http://s/vtv1.m3u8\r\n' +
    '#EXTINF:-1 tvg-name="Kenh B" group-title="Phim, hay" ,Kênh, B\r\n' +
    'http://s/b.m3u8\r\n' +
    '#EXTGRP:Thể thao\r\n' +
    '#EXTINF:-1,Sport 1\r\n' +
    'http://s/sport1.ts\r\n' +
    '#EXTINF:-1 group-title="",NoGroup\n' +
    'http://s/ng.ts\n' +
    '#EXTINF:-1,\n' +
    'http://s/noname.ts\n';
  const r = m3u.parse(text);
  assert.equal(r.epgUrl, 'http://e.example/epg.xml.gz');
  assert.equal(r.channels.length, 5);
  assert.deepEqual(r.channels[0], { id: 'VTV1.vn', name: 'VTV1 HD', url: 'http://s/vtv1.m3u8', logo: 'http://l/1.png', group: 'Quốc gia' });
  assert.equal(r.channels[1].name, 'Kênh, B');
  assert.equal(r.channels[1].group, 'Phim, hay');
  assert.equal(r.channels[2].group, 'Thể thao');
  assert.equal(r.channels[3].group, 'Khác');          // group-title rỗng -> Khác (giống bản Android)
  assert.equal(r.channels[4].name, 'Kênh 5');          // không tên -> "Kênh N"
});

test('M3U: luồng HLS đơn thành 1 kênh; bỏ kênh trùng (cùng nhóm + link)', () => {
  const single = m3u.parseText('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv.m3u8\n', 'http://x/live.m3u8');
  assert.equal(single.channels.length, 1);
  assert.equal(single.channels[0].url, 'http://x/live.m3u8');
  const dup = m3u.parseText('#EXTINF:-1 group-title="A",X\nhttp://a\n#EXTINF:-1 group-title="A",X2\nhttp://a\n#EXTINF:-1 group-title="B",X\nhttp://a\n', 'u');
  assert.equal(dup.channels.length, 2);
});

test('Thời gian XMLTV: có múi giờ và không có múi giờ', () => {
  assert.equal(epg.parseTime('20261102100000 +0700'), Date.UTC(2026, 10, 2, 3, 0, 0));
  assert.equal(epg.parseTime('20261102100000 -0500'), Date.UTC(2026, 10, 2, 15, 0, 0));
  assert.equal(epg.parseTime('20261102100000'), Date.UTC(2026, 10, 2, 10, 0, 0));
  assert.equal(epg.parseTime('2026'), 0);
});

function xmltv(now) {
  const f = (ms) => {
    const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())} +0000`;
  };
  const H = 3600000;
  let x = '<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n<channel id="VTV1.vn"><display-name>VTV1</display-name></channel>\n';
  x += `<programme start="${f(now - 3 * H)}" stop="${f(now - 2.5 * H)}" channel="VTV1.vn"><title>Quá cũ</title></programme>\n`;
  x += `<programme start="${f(now - H)}" stop="${f(now + H)}" channel="VTV1.vn"><title lang="vi">Tin &amp; Thời sự &lt;1&gt;</title><desc>x</desc></programme>\n`;
  x += `<programme start="${f(now + H)}" stop="${f(now + 2 * H)}" channel="vtv1.VN"><title><![CDATA[Phim "A"]]></title></programme>\n`;
  x += `<programme start="${f(now + H)}" stop="${f(now + 2 * H)}" channel="VTV1.vn"><title>Trùng giờ</title></programme>\n`;
  x += `<programme start="${f(now + 30 * H)}" stop="${f(now + 31 * H)}" channel="VTV1.vn"><title>Quá xa</title></programme>\n`;
  x += `<programme start='${f(now)}' stop='${f(now + H)}' channel='K2'><title>Kênh hai &#272;&#x1EA1;i</title></programme>\n</tv>\n`;
  return x;
}

for (const mode of ['xml', 'gzip']) {
  test(`EPG (${mode}): lọc cửa sổ -2h..+24h, giải mã thực thể, bỏ trùng`, async () => {
    const now = Date.now();
    let buf = Buffer.from(xmltv(now), 'utf8');
    if (mode === 'gzip') buf = zlib.gzipSync(buf);
    const map = await epg.parse(new Uint8Array(buf), now);
    assert.deepEqual(Object.keys(map).sort(), ['k2', 'vtv1.vn']);
    const v = map['vtv1.vn'];
    assert.equal(v.length, 2);
    assert.equal(v[0].title, 'Tin & Thời sự <1>');
    assert.equal(v[1].title, 'Phim "A"');                 // bản ghi trùng giờ bắt đầu: giữ bản đầu tiên
    assert.equal(map['k2'][0].title, 'Kênh hai Đại');
  });
}

test('EPG: XML lớn chia nhiều khối (ranh giới thẻ nằm giữa 2 khối)', async () => {
  const now = Date.now(), H = 3600000;
  const f = (ms) => { const d = new Date(ms), p = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())} +0000`; };
  let x = '<tv>';
  const N = 20000;
  for (let i = 0; i < N; i++) x += `<programme start="${f(now + (i % 20) * H)}" stop="${f(now + (i % 20 + 1) * H)}" channel="c${i}"><title>Chương trình số ${i} có tiếng Việt</title></programme>\n`;
  x += '</tv>';
  const raw = Buffer.from(x, 'utf8');
  for (const buf of [raw, zlib.gzipSync(raw)]) {
    const map = await epg.parse(new Uint8Array(buf), now);
    assert.equal(Object.keys(map).length, N);
    assert.equal(map['c12345'][0].title, 'Chương trình số 12345 có tiếng Việt');
  }
});

test('buildCells: ô chương trình + khối khoảng trống theo giờ', () => {
  const H = G.HOUR, from = 10 * H + 30 * 60000, to = from + 4 * H;
  const list = [
    { start: from - H, stop: from + 20 * 60000, title: 'A' },      // bắt đầu trước cửa sổ
    { start: from + H, stop: from + 2 * H, title: 'B' },           // có khoảng trống phía trước
    { start: from + 3.5 * H, stop: from + 9 * H, title: 'C' }      // vượt quá cuối cửa sổ
  ];
  const cells = G.buildCells(list, from, to);
  // liên tiếp, phủ kín [from, to)
  assert.equal(cells[0].start, from);
  assert.equal(cells[cells.length - 1].end, to);
  for (let i = 1; i < cells.length; i++) assert.equal(cells[i].start, cells[i - 1].end);
  assert.equal(cells[0].programme.title, 'A');
  assert.equal(cells[0].end, from + 20 * 60000);
  assert.equal(cells[cells.length - 1].programme.title, 'C');
  assert.equal(cells[cells.length - 1].end, to);
  // khoảng trống chia theo mốc giờ tròn
  const gaps = cells.filter(c => !c.programme);
  for (const g of gaps) assert.ok(g.end - g.start <= H);
  // không có EPG: toàn khối "không có thông tin"
  const none = G.buildCells(null, from, to);
  assert.ok(none.every(c => c.programme === null));
  assert.equal(none[0].start, from);
  assert.equal(none[none.length - 1].end, to);
});

test('nowPlaying / nextPlaying / cellAt / tiện ích', () => {
  const epgMap = { 'abc': [{ start: 0, stop: 10, title: 'x' }, { start: 10, stop: 20, title: 'y' }] };
  const ch = { id: 'ABC' };
  assert.equal(G.nowPlaying(epgMap, ch, 5).title, 'x');
  assert.equal(G.nowPlaying(epgMap, ch, 10).title, 'y');
  assert.equal(G.nowPlaying(epgMap, ch, 25), null);
  assert.equal(G.nextPlaying(epgMap, ch, 5).title, 'y');
  assert.equal(G.nowPlaying(epgMap, { id: '' }, 5), null);
  assert.equal(G.nowPlaying({}, { id: 'constructor' }, 5), null);
  assert.equal(G.cellAt([{ start: 0, end: 5 }, { start: 5, end: 9 }], 6), 1);
  assert.equal(U.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(U.minutesLeft({ stop: 61000 }, 0), 2);
  assert.equal(U.progress({ start: 0, stop: 100 }, 50), 0.5);
});
