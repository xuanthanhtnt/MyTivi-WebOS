/* Tải playlist / EPG bằng XMLHttpRequest (chạy được trên cả Chromium cũ của webOS 4). */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};

  function xhr(url, timeout, headers) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest(), done = false;
      function fail(msg, network, status) {
        if (done) return;
        done = true;
        var e = new Error(msg);
        e.network = !!network;
        e.status = status || 0;
        reject(e);
      }
      try {
        x.open('GET', url, true);
        x.responseType = 'arraybuffer';
        x.timeout = timeout || 60000;
        for (var h in headers || {}) x.setRequestHeader(h, headers[h]);
      } catch (e) { return fail('Link không hợp lệ', false); }
      x.onload = function () {
        if (x.status >= 200 && x.status < 300) { done = true; resolve(x.response); }
        else fail('HTTP ' + x.status, false, x.status);
      };
      x.onerror = function () { fail('Không kết nối được máy chủ (lỗi mạng hoặc bị chặn CORS)', true); };
      x.ontimeout = function () { fail('Hết thời gian chờ', true); };
      x.send();
    });
  }

  function proxify(prefix, url) {
    return prefix.indexOf('{url}') >= 0
      ? prefix.replace('{url}', encodeURIComponent(url))
      : prefix + encodeURIComponent(url);
  }

  /**
   * Tải về ArrayBuffer. Lỗi mạng/CORS mà đã cấu hình proxy thì thử lại qua proxy.
   * opt: { timeout, headers, noProxy (không đi qua proxy, vd khi tải bản cập nhật từ GitHub) }
   */
  function get(url, opt) {
    opt = opt || {};
    var timeout = opt.timeout || 60000;
    return xhr(url, timeout, opt.headers).catch(function (e) {
      var px = MT.prefs && MT.prefs.proxy;
      if (e.network && px && !opt.noProxy) return xhr(proxify(px, url), timeout, opt.headers);
      throw e;
    });
  }

  /** Giải nén gzip nếu cần rồi đọc thành chuỗi UTF-8 (bỏ BOM). */
  function toText(buf) {
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) u8 = root.pako.inflate(u8);
    var s = new TextDecoder('utf-8').decode(u8);
    return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
  }

  function getText(url, opt) {
    return get(url, opt).then(toText);
  }

  MT.net = { get: get, getText: getText, toText: toText, proxify: proxify };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.net;
})(typeof window !== 'undefined' ? window : global);
