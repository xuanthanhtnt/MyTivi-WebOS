/* Đọc lịch phát sóng XMLTV (chuyển từ EpgParser.kt).
 * Chỉ giữ chương trình từ -2 giờ đến +24 giờ để tiết kiệm RAM.
 * Đọc theo từng khối (không nạp cả file XML vào bộ nhớ) và tự giải nén .gz bằng pako. */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};

  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

  function decodeText(s) {
    s = s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, function (m, e) {
      if (e.charAt(0) === '#') {
        var n = e.charAt(1) === 'x' ? parseInt(e.substring(2), 16) : parseInt(e.substring(1), 10);
        return isNaN(n) ? m : String.fromCharCode(n);
      }
      return Object.prototype.hasOwnProperty.call(ENT, e) ? ENT[e] : m;
    }).trim();
  }

  /** "20261102100000 +0700" -> epoch ms. Không có múi giờ thì coi là UTC. 0 nếu sai định dạng. */
  function parseTime(s) {
    if (!s) return 0;
    s = String(s).trim();
    if (s.length < 14) return 0;
    var t = Date.UTC(+s.substr(0, 4), +s.substr(4, 2) - 1, +s.substr(6, 2),
      +s.substr(8, 2), +s.substr(10, 2), +s.substr(12, 2));
    if (isNaN(t)) return 0;
    if (s.length > 14) {
      var z = /([+-])(\d{2}):?(\d{2})/.exec(s.substring(14));
      if (!z) return 0;
      var off = (+z[2] * 60 + +z[3]) * 60000;
      t -= (z[1] === '-' ? -off : off);
    }
    return t;
  }

  function Scanner(now) {
    this.from = now - 2 * 3600000;
    this.to = now + 24 * 3600000;
    this.map = {};
    this.buf = '';
  }

  /** Nhận thêm một đoạn văn bản XML; xử lý các thẻ <programme> đã đủ, giữ phần dở dang cho lần sau. */
  Scanner.prototype.push = function (str) {
    var s = this.buf + str, last = 0, m, re = /<programme\b([^>]*?)(?:\/>|>([\s\S]*?)<\/programme>)/g;
    while ((m = re.exec(s)) !== null) {
      last = re.lastIndex;
      this._one(m[1], m[2] || '');
    }
    var rest = s.substring(last), i = rest.indexOf('<programme');
    this.buf = i >= 0 ? rest.substring(i) : rest.slice(-12);
  };

  Scanner.prototype._one = function (attrStr, body) {
    var a = {}, re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, m;
    while ((m = re.exec(attrStr)) !== null) a[m[1]] = m[2] !== undefined ? m[2] : m[3];
    var channel = (a.channel || '').toLowerCase();
    if (!channel) return;
    var start = parseTime(a.start), stop = parseTime(a.stop);
    if (!(stop > this.from && start < this.to)) return;
    var t = /<title\b[^>]*>([\s\S]*?)<\/title>/.exec(body);
    if (!t) return;
    var title = decodeText(t[1]);
    if (!title) return;
    var list = Object.prototype.hasOwnProperty.call(this.map, channel) ? this.map[channel] : (this.map[channel] = []);
    list.push({ start: start, stop: stop, title: title });
  };

  /** Sắp theo giờ và bỏ bản ghi trùng (một số nguồn EPG lặp lại chương trình). */
  Scanner.prototype.result = function () {
    var out = {}, keys = Object.keys(this.map);
    for (var i = 0; i < keys.length; i++) {
      var list = this.map[keys[i]].slice().sort(function (x, y) { return x.start - y.start; });
      var seen = {}, uniq = [];
      for (var j = 0; j < list.length; j++) {
        if (!Object.prototype.hasOwnProperty.call(seen, list[j].start)) {
          seen[list[j].start] = 1;
          uniq.push(list[j]);
        }
      }
      out[keys[i]] = uniq;
    }
    return out;
  };

  /**
   * buf: ArrayBuffer | Uint8Array (XML thường hoặc gzip). Trả về Promise<{ [kênh]: [{start, stop, title}] }>.
   * Xử lý từng khối nhỏ và nhường luồng giao diện giữa các khối để TV không bị đơ.
   */
  function parse(buf, now) {
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var gz = u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b;
    var dec = new TextDecoder('utf-8');
    var sc = new Scanner(now);
    var inf = null;
    if (gz) {
      inf = new root.pako.Inflate();
      inf.onData = function (chunk) { sc.push(dec.decode(chunk, { stream: true })); };
    }
    var pos = 0, STEP = 256 * 1024;

    return new Promise(function (resolve, reject) {
      function step() {
        try {
          var end = Math.min(pos + STEP, u8.length), last = end >= u8.length;
          var slice = u8.subarray(pos, end);
          if (inf) {
            inf.push(slice, last);
            if (inf.err) throw new Error('Giải nén EPG lỗi: ' + (inf.msg || inf.err));
          } else {
            sc.push(dec.decode(slice, { stream: !last }));
          }
          pos = end;
          if (last) return resolve(sc.result());
          setTimeout(step, 0);
        } catch (e) { reject(e); }
      }
      step();
    });
  }

  MT.epg = { parse: parse, parseTime: parseTime, Scanner: Scanner };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.epg;
})(typeof window !== 'undefined' ? window : global);
