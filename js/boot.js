/* Nạp mã của app khi mở (file này chỉ thay được bằng cách cài lại .ipk, nên giữ thật gọn).
 *
 * Cập nhật trong app (tương đương tự cập nhật APK của bản Android): js/update.js tải mã của bản phát hành mới nhất
 * trên GitHub rồi lưu vào localStorage. Lần mở sau, nếu bản đã lưu MỚI HƠN bản đóng gói trong .ipk thì nạp bản đó,
 * không thì nạp các file có sẵn (window.MT_SCRIPTS trong index.html).
 * Bản tải về làm app không khởi động được 2 lần liền thì tự bỏ, quay về bản trong .ipk. */
(function (root) {
  'use strict';

  var KEY = 'mytivi.ota', TRY = 'mytivi.otaTry', BAD = 'mytivi.otaBad', MAX_TRIES = 2;
  var ls = null;
  try { ls = root.localStorage || null; } catch (e) { ls = null; }

  function meta(name) {
    var m = document.querySelector('meta[name="' + name + '"]');
    return m ? m.getAttribute('content') : '';
  }
  function get(k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { try { if (ls) ls.setItem(k, v); } catch (e) { /* bỏ qua */ } }
  function del(k) { try { if (ls) ls.removeItem(k); } catch (e) { /* bỏ qua */ } }

  /** So sánh phiên bản x.y.z: >0 nếu a mới hơn b. */
  function cmp(a, b) {
    var x = String(a || '0').split('.'), y = String(b || '0').split('.');
    for (var i = 0; i < 3; i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d;
    }
    return 0;
  }

  var B = root.MT_BOOT = {
    api: +meta('mytivi-boot') || 1,
    bundled: meta('mytivi-version'),
    version: meta('mytivi-version'),       // phiên bản đang chạy
    ota: false,                            // true: đang chạy bản tải từ GitHub
    bad: get(BAD) || '',                   // bản tải về từng làm app không khởi động được
    cmp: cmp,

    /** Lưu bản tải về để lần mở sau dùng. Ném lỗi nếu bộ nhớ không đủ. */
    store: function (bundle) {
      if (!ls) throw new Error('TV không cho lưu dữ liệu (localStorage)');
      ls.setItem(KEY, JSON.stringify(bundle));
      del(TRY);
      if (B.bad === bundle.version) { del(BAD); B.bad = ''; }
    },

    /** Bản đã tải, đang chờ mở lại app để dùng (hoặc null). */
    pending: function () {
      var o = read();
      return o && cmp(o.version, B.version) > 0 ? o.version : null;
    },

    /** app.js gọi khi đã khởi động xong: bản đang chạy dùng được. */
    ok: function () { del(TRY); }
  };

  function read() {
    try {
      var o = JSON.parse(get(KEY) || 'null');
      return o && o.api === B.api && o.version && typeof o.html === 'string' && typeof o.css === 'string' &&
        o.js && o.js.length ? o : null;
    } catch (e) { return null; }
  }

  function loadLocal() {
    var list = root.MT_SCRIPTS || [];
    for (var i = 0; i < list.length; i++) {
      var s = document.createElement('script');
      s.src = list[i];
      s.async = false;                     // giữ đúng thứ tự chạy
      document.body.appendChild(s);
    }
  }

  function runOta(o) {
    var app = document.getElementById('app');
    app.innerHTML = o.html;
    var st = document.createElement('style');
    st.id = 'otaCss';
    st.textContent = o.css;
    document.head.appendChild(st);
    var link = document.getElementById('appCss');
    if (link) link.parentNode.removeChild(link);
    B.ota = true;
    B.version = o.version;
    for (var i = 0; i < o.js.length; i++) {
      /* jshint evil:true */
      new Function(o.js[i].code + '\n//# sourceURL=ota/' + o.js[i].path)();
    }
  }

  var o = read();
  if (o && (cmp(o.version, B.bundled) <= 0 || o.version === B.bad)) {
    del(KEY);                              // đã cài .ipk mới hơn (hoặc bản này hỏng): bỏ bản tải về
    o = null;
  }
  if (o) {
    // Đếm số lần mở bản này mà chưa khởi động xong; quá MAX_TRIES thì coi là hỏng
    var t = (get(TRY) || '').split('|'), n = t[0] === o.version ? (+t[1] || 0) + 1 : 1;
    if (n > MAX_TRIES) {
      set(BAD, o.version);
      B.bad = o.version;
      del(KEY);
      del(TRY);
      o = null;
    } else {
      set(TRY, o.version + '|' + n);
    }
  }
  if (o) {
    try {
      runOta(o);
      return;
    } catch (e) {
      if (root.console) console.error('Bản cập nhật lỗi, quay về bản trong .ipk:', e);
      set(BAD, o.version);
      del(KEY);
      del(TRY);
      root.location.reload();
      return;
    }
  }
  loadLocal();
})(window);
