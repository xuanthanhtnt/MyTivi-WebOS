/* Đọc playlist M3U/M3U8 dạng IPTV:  #EXTINF:-1 tvg-id="" tvg-logo="" group-title="",Tên kênh
 * (chuyển từ M3uParser.kt + MainViewModel.parseText của bản Android). */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};

  function readAttrs(line) {
    var re = /([\w-]+)="([^"]*)"/g, out = {}, m;
    while ((m = re.exec(line)) !== null) out[m[1].toLowerCase()] = m[2];
    return out;
  }

  /** Tên kênh nằm sau dấu phẩy đầu tiên nằm NGOÀI cặp ngoặc kép. */
  function nameAfterComma(line) {
    var inQuote = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (c === '"') inQuote = !inQuote;
      else if (c === ',' && !inQuote) return line.substring(i + 1).trim();
    }
    return '';
  }

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function parse(text) {
    var channels = [], epgUrl = null, attrs = {}, name = '', extGroup = null, pending = false;
    var lines = String(text).split(/\r\n|\n|\r/);

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim().replace(/^﻿/, '');
      if (line.indexOf('#EXTM3U') === 0) {
        var a = readAttrs(line), u = a['url-tvg'] || a['x-tvg-url'];
        epgUrl = u ? u.split(',')[0].trim() : null;
      } else if (line.indexOf('#EXTINF') === 0) {
        attrs = readAttrs(line);
        name = nameAfterComma(line);
        pending = true;
      } else if (line.indexOf('#EXTGRP:') === 0) {
        extGroup = line.substring(line.indexOf(':') + 1).trim();
      } else if (line === '' || line.charAt(0) === '#') {
        /* bỏ qua */
      } else if (pending) {
        var finalName = name || attrs['tvg-name'] || ('Kênh ' + (channels.length + 1));
        var group = has(attrs, 'group-title') ? attrs['group-title'] : extGroup;
        if (!group || !group.trim()) group = 'Khác';
        channels.push({
          id: attrs['tvg-id'] || '',
          name: finalName,
          url: line,
          logo: attrs['tvg-logo'] || '',
          group: group
        });
        pending = false;
        extGroup = null;
      }
    }
    return { channels: channels, epgUrl: epgUrl };
  }

  /**
   * Nếu link là một luồng HLS đơn (không phải danh sách kênh) thì coi như 1 kênh.
   * Kênh trùng hoàn toàn (cùng nhóm + cùng link) chỉ giữ 1.
   */
  function parseText(text, url) {
    var parsed = parse(text);
    if (parsed.channels.length === 0 && String(text).indexOf('#EXT-X-') >= 0) {
      return {
        channels: [{ id: '', name: 'Luồng trực tiếp', url: url, logo: '', group: 'Khác' }],
        epgUrl: null
      };
    }
    var seen = {}, out = [];
    for (var i = 0; i < parsed.channels.length; i++) {
      var c = parsed.channels[i], key = c.group + '\u0000' + c.url;
      if (!has(seen, key)) { seen[key] = 1; out.push(c); }
    }
    return { channels: out, epgUrl: parsed.epgUrl };
  }

  MT.m3u = { parse: parse, parseText: parseText };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.m3u;
})(typeof window !== 'undefined' ? window : global);
