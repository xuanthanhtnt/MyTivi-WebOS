/* Tiện ích chung: định dạng giờ, escape HTML, biểu tượng ngôi sao. */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};

  var DAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var DAYS_LONG = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z';

  function p2(n) { return n < 10 ? '0' + n : String(n); }

  var util = {
    VERSION: '1.1.0',            // phải khớp appinfo.json và <meta name="mytivi-version"> trong index.html

    /** Escape mọi chuỗi đến từ playlist/EPG trước khi đưa vào innerHTML. */
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
    },

    hhmm: function (ms) {
      var d = new Date(ms);
      return p2(d.getHours()) + ':' + p2(d.getMinutes());
    },

    /** Ví dụ: "T2, 02/11  10:07" */
    dateShort: function (ms) {
      var d = new Date(ms);
      return DAYS_SHORT[d.getDay()] + ', ' + p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '  ' + util.hhmm(ms);
    },

    /** Ví dụ: "Thứ hai, 02/11" */
    dateLong: function (ms) {
      var d = new Date(ms);
      return DAYS_LONG[d.getDay()] + ', ' + p2(d.getDate()) + '/' + p2(d.getMonth() + 1);
    },

    /** Tiến độ chương trình 0..1 */
    progress: function (p, now) {
      var v = (now - p.start) / Math.max(1, p.stop - p.start);
      return v < 0 ? 0 : v > 1 ? 1 : v;
    },

    minutesLeft: function (p, now) {
      return Math.floor((p.stop - now + 59999) / 60000);
    },

    isHttp: function (s) { return /^https?:\/\//i.test(s); },

    clamp: function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },

    /** Ngôi sao dạng SVG (không phụ thuộc font của TV). */
    star: function (on) {
      return '<svg class="ic ' + (on ? 'on' : 'empty') + '" viewBox="0 0 24 24"><path d="' + STAR_PATH + '"/></svg>';
    }
  };

  MT.util = util;
  if (typeof module !== 'undefined' && module.exports) module.exports = util;
})(typeof window !== 'undefined' ? window : global);
