/* Cập nhật trong app (chuyển từ Updater.kt, UpdateViewModel.kt, UpdateDialog.kt của bản Android).
 *  - Đổi phiên bản trong appinfo.json rồi push lên GitHub: Actions đóng gói .ipk và tạo Release "v<phiên bản>".
 *  - App đọc Release mới nhất; có bản mới thì tải mã (HTML/CSS/JS) của đúng bản đó từ GitHub và lưu lại,
 *    khởi động lại là chạy bản mới (xem js/boot.js). webOS không cho app tự cài .ipk, nên đây là cách cập nhật
 *    ngay trên TV, không cần máy tính.
 *  - Bản mới đổi phần nạp mã (meta "mytivi-boot" khác) thì không cập nhật kiểu này được: hộp thoại hướng dẫn cài .ipk. */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};

  var REPO = 'xuanthanhtnt/MyTivi-WebOS';
  var API = 'https://api.github.com/repos/' + REPO + '/releases/latest';

  /** Link file của một bản phát hành: GitHub trước, jsDelivr dự phòng (cả hai đều cho phép CORS). */
  function fileUrls(tag, path) {
    return ['https://raw.githubusercontent.com/' + REPO + '/' + tag + '/' + path,
      'https://cdn.jsdelivr.net/gh/' + REPO + '@' + tag + '/' + path];
  }

  /** So sánh phiên bản x.y.z: >0 nếu a mới hơn b. */
  function cmp(a, b) {
    var x = String(a || '0').split('.'), y = String(b || '0').split('.');
    for (var i = 0; i < 3; i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d;
    }
    return 0;
  }

  /** JSON của API GitHub Releases -> { version, tag, notes } (null nếu tag không dạng v1.2.3). */
  function parseRelease(json) {
    var m = /^v?(\d+\.\d+\.\d+)$/i.exec(String(json && json.tag_name || '').trim());
    if (!m) return null;
    return { version: m[1], tag: json.tag_name, notes: String(json.body || '').trim() };
  }

  function between(s, a, b) {
    var i = s.indexOf(a), j = s.indexOf(b, i + a.length);
    if (i < 0 || j < 0) throw new Error('index.html của bản mới không đúng định dạng');
    return s.substring(i + a.length, j);
  }

  function safePath(p) {
    if (!/^[\w\/.-]+$/.test(p) || p.indexOf('..') >= 0 || p.charAt(0) === '/') throw new Error('Đường dẫn lạ: ' + p);
    return p;
  }

  /** Đọc index.html của bản mới: phần thân app, file CSS, danh sách mã JS (theo các dấu <!--app:...--> ). */
  function parseIndex(html) {
    var boot = /<meta name="mytivi-boot" content="(\d+)"/.exec(html);
    var ver = /<meta name="mytivi-version" content="([\d.]+)"/.exec(html);
    var css = [], re = /href="([^"]+)"/g, m;
    var cssPart = between(html, '<!--app:css-->', '<!--/app:css-->');
    while ((m = re.exec(cssPart)) !== null) css.push(safePath(m[1]));
    var arr = /\[[\s\S]*?\]/.exec(between(html, '<!--app:scripts-->', '<!--/app:scripts-->'));
    var scripts = arr ? JSON.parse(arr[0]) : [];
    if (!scripts.length) throw new Error('Bản mới không có mã chạy');
    for (var i = 0; i < scripts.length; i++) safePath(scripts[i]);
    return {
      boot: boot ? +boot[1] : 0,
      version: ver ? ver[1] : '',
      body: between(html, '<!--app:body-->', '<!--/app:body-->'),
      css: css,
      scripts: scripts
    };
  }

  /* ============================== Trạng thái ============================== */

  // s: idle | checking | uptodate | available | downloading | ready | needIpk | failed
  var st = { s: 'idle', info: null, done: 0, total: 0, msg: '' };
  var listeners = [], job = 0, open = false, bi = 0, E = {};

  function set(s, extra) {
    st = { s: s, info: null, done: 0, total: 0, msg: '' };
    for (var k in extra || {}) st[k] = extra[k];
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { if (root.console) console.error(e); }
    }
    if (open) render();
  }

  function current() { return MT.util.VERSION; }
  function boot() { return root.MT_BOOT || null; }
  function errMsg(e) { return e && e.message ? e.message : String(e); }

  function check(silent) {
    if (st.s === 'checking' || st.s === 'downloading') return;
    var my = ++job;
    set('checking');
    MT.net.getText(API, { timeout: 15000, noProxy: true, headers: { Accept: 'application/vnd.github+json' } })
      .then(function (text) { return parseRelease(JSON.parse(text)); }, function (e) {
        if (e.status === 404) return null;                       // repo chưa có bản phát hành nào
        if (e.status === 403 || e.status === 429) throw new Error('GitHub tạm giới hạn lượt kiểm tra, thử lại sau ít phút');
        throw e;
      })
      .then(function (info) {
        if (my !== job) return;
        if (!info || cmp(info.version, current()) <= 0) return set('uptodate');
        var b = boot();
        set(b && b.pending() === info.version ? 'ready' : 'available', { info: info });
      })
      .catch(function (e) {
        if (my !== job) return;
        if (silent) set('idle');
        else set('failed', { msg: 'Không kiểm tra được cập nhật: ' + errMsg(e) });
      });
  }

  function fetchText(tag, path) {
    var urls = fileUrls(tag, path), opt = { timeout: 30000, noProxy: true };
    return MT.net.getText(urls[0], opt).catch(function () { return MT.net.getText(urls[1], opt); });
  }

  /** Tải mã của bản mới (từng file, báo tiến độ), lưu lại để lần khởi động sau dùng. Hủy (dismiss) là dừng. */
  function download(info) {
    var b = boot(), my = ++job;
    if (!b) return set('failed', { msg: 'Bản đang chạy không hỗ trợ cập nhật trong app, hãy cài lại file .ipk.' });
    set('downloading', { info: info, done: 0, total: 1 });
    var idx, files, out = { css: [], js: [] };

    fetchText(info.tag, 'index.html').then(function (html) {
      if (my !== job) return null;
      idx = parseIndex(html);
      if (idx.boot !== b.api) { set('needIpk', { info: info }); return null; }
      if (idx.version !== info.version) throw new Error('bản phát hành ' + info.tag + ' ghi phiên bản ' + (idx.version || '?'));
      files = idx.css.concat(idx.scripts);
      var i = 0;
      function next() {
        if (my !== job) return null;
        set('downloading', { info: info, done: i + 1, total: files.length + 1 });
        if (i >= files.length) return true;
        var path = files[i];
        return fetchText(info.tag, path).then(function (text) {
          if (i < idx.css.length) out.css.push(text); else out.js.push({ path: path, code: text });
          i++;
          return next();
        });
      }
      return next();
    }).then(function (done) {
      if (!done || my !== job) return;
      try {
        b.store({ api: b.api, version: info.version, tag: info.tag, time: Date.now(), html: idx.body, css: out.css.join('\n'), js: out.js });
      } catch (e) {
        throw new Error('không lưu được bản cập nhật (' + errMsg(e) + ')');
      }
      set('ready', { info: info });
    }).catch(function (e) {
      if (my === job) set('failed', { msg: 'Tải bản cập nhật lỗi: ' + errMsg(e) });
    });
  }

  /* ============================== Hộp thoại ============================== */

  function btn(label, fn) { return { label: label, fn: fn }; }
  function restart() { root.location.reload(); }

  function view() {
    var U = MT.util, i = st.info, v = i ? U.esc(i.version) : '', h, b;
    switch (st.s) {
      case 'uptodate':
        return { h: 'Bạn đang dùng bản mới nhất.', b: [btn('Đóng', dismiss)] };
      case 'available':
        h = '<div class="hl">Có bản mới: ' + v + '</div>' + (i.notes ? '<div class="notes">' + U.esc(i.notes) + '</div>' : '');
        return { h: h, b: [btn('Cập nhật ngay', function () { download(i); }), btn('Để sau', dismiss)] };
      case 'downloading':
        var p = st.total ? Math.round(st.done / st.total * 100) : 0;
        h = 'Đang tải… ' + p + '%<span class="bar wide"><i style="width:' + p + '%"></i></span>';
        return { h: h, b: [btn('Hủy', dismiss)] };
      case 'ready':
        h = '<div class="hl">Đã tải xong bản ' + v + '.</div>' +
          '<div class="small">Khởi động lại MyTivi để dùng bản mới (để sau thì lần mở app tới sẽ tự dùng).</div>';
        return { h: h, b: [btn('Khởi động lại', restart), btn('Để sau', dismiss)] };
      case 'needIpk':
        h = '<div class="hl">Bản ' + v + ' cần cài lại file .ipk.</div>' +
          '<div class="small">Bản này thay đổi phần lõi của app nên không cập nhật ngay trên TV được. Tải MyTivi.ipk tại ' +
          'github.com/' + REPO + '/releases rồi cài bằng ares-install hoặc Dev Manager (xem README).</div>';
        return { h: h, b: [btn('Đóng', dismiss)] };
      case 'failed':
        return { h: '<span class="err">' + U.esc(st.msg) + '</span>', b: [btn('Thử lại', function () { check(false); }), btn('Đóng', dismiss)] };
      default:                                                     // idle, checking
        return { h: '<i class="spin sm"></i>Đang kiểm tra bản mới…', b: [btn('Đóng', dismiss)] };
    }
  }

  var buttons = [], lastS = null;

  function render() {
    var v = view(), h = '';
    if (st.s !== lastS) { bi = 0; lastS = st.s; }               // đổi bước thì focus về nút đầu, như bản Android
    buttons = v.b;
    bi = Math.min(bi, buttons.length - 1);
    E.updCur.textContent = 'Bản đang dùng: ' + current();
    E.updBody.innerHTML = v.h;
    for (var i = 0; i < buttons.length; i++) {
      h += '<div class="btn' + (i === bi ? ' focus' : '') + '" data-i="' + i + '">' + MT.util.esc(buttons[i].label) + '</div>';
    }
    E.updBtns.innerHTML = h;
  }

  /** Nút "Kiểm tra cập nhật" (ngăn nhóm kênh / Cài đặt). */
  function openDialog() {
    open = true;
    lastS = null;
    E.upd.classList.remove('hide');
    if (st.s === 'idle' || st.s === 'uptodate' || st.s === 'failed') check(false);
    render();
  }

  function dismiss() {
    open = false;
    E.upd.classList.add('hide');
    if (st.s === 'downloading') { job++; set('available', { info: st.info }); }
    else if (st.s === 'failed') set('idle');
  }

  function onKey(k) {
    switch (k) {
      case 'left': if (bi > 0) { bi--; render(); } return true;
      case 'right': if (bi < buttons.length - 1) { bi++; render(); } return true;
      case 'enter': if (buttons[bi]) buttons[bi].fn(); return true;
      case 'back': dismiss(); return true;
    }
    return true;                                                   // hộp thoại đang mở: chặn mọi phím khác
  }

  function init() {
    var ids = ['upd', 'updCur', 'updBody', 'updBtns'];
    for (var i = 0; i < ids.length; i++) E[ids[i]] = document.getElementById(ids[i]);
    E.updBtns.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-i') !== null) { bi = +t.getAttribute('data-i'); render(); buttons[bi].fn(); }
    });
    var b = boot(), p = b && b.pending();
    if (p) set('ready', { info: { version: p, tag: 'v' + p, notes: '' } });   // đã tải sẵn, chờ khởi động lại
  }

  MT.update = {
    REPO: REPO,
    init: init,
    check: check,
    openDialog: openDialog,
    dialogOpen: function () { return open; },
    onKey: onKey,
    on: function (fn) { listeners.push(fn); },
    state: function () { return st; },
    /** Có bản mới (chưa tải hoặc đã tải xong chờ khởi động lại): nút cập nhật đổi màu. */
    available: function () { return st.s === 'available' || st.s === 'ready'; },
    label: function () {
      switch (st.s) {
        case 'available': return 'Cập nhật lên bản ' + st.info.version;
        case 'ready': return 'Khởi động lại để dùng bản ' + st.info.version;
        case 'checking': return 'Đang kiểm tra cập nhật…';
        case 'downloading': return 'Đang tải bản cập nhật…';
      }
      return 'Kiểm tra cập nhật';
    },
    cmp: cmp,
    parseRelease: parseRelease,
    parseIndex: parseIndex
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.update;
})(typeof window !== 'undefined' ? window : global);
