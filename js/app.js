/* Khởi động, điều hướng giữa các màn hình và nhận phím từ remote (chuyển từ MainActivity.kt). */
(function (root) {
  'use strict';
  var MT = root.MT, D = MT.data;

  // Mã phím remote webOS: Back 461, CH+/CH- 427/428, Info 457, Đỏ/Xanh lá/Vàng/Xanh dương 403-406.
  // Thêm vài phím bàn phím để thử trên máy tính: Esc/Backspace = Back, PageUp/PageDown = CH+/CH-, F = Vàng, I = Info.
  var KEYS = {
    37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter',
    461: 'back', 27: 'back', 8: 'back',
    427: 'chUp', 428: 'chDown', 33: 'chUp', 34: 'chDown',
    457: 'info', 73: 'info',
    403: 'red', 404: 'green', 405: 'yellow', 406: 'blue', 70: 'yellow'
  };

  // Bố cục thiết kế: cao ít nhất 1080, rộng ít nhất 1280 "px thiết kế" (xem đầu css/app.css)
  var BASE_H = 1080, MIN_W = 1280;

  var screens = {}, cur = null, curName = null, autoStarted = false, layoutFns = [];

  /** Kích thước #stage (px thiết kế) và tỉ lệ phóng ra px thật của cửa sổ. */
  var layout = { W: 1920, H: 1080, k: 1, on: function (fn) { layoutFns.push(fn); } };

  function go(name, arg) {
    if (cur && cur.leave) cur.leave();
    curName = name;
    cur = screens[name];
    cur.enter(arg);
  }

  function openWatch(list, index) { go('watch', { list: list, index: index }); }

  function exit() {
    try { if (root.PalmSystem && root.PalmSystem.platformBack) { root.PalmSystem.platformBack(); return; } } catch (e) { /* thử cách khác */ }
    try { if (root.webOS && root.webOS.platformBack) { root.webOS.platformBack(); return; } } catch (e2) { /* thử cách khác */ }
    root.close();
  }

  /**
   * Co giãn bố cục theo cửa sổ thật, lấp kín màn hình ở mọi tỉ lệ (không viền đen):
   *  - TV 4K: cửa sổ 1920x1080 -> giữ nguyên.  TV Full HD: 1280x720 -> thu 2/3.  Màn 16:9 nào cũng là 1920x1080 px thiết kế.
   *  - 16:10, 4:3: #stage hẹp lại (vd 1728x1080); 21:9: rộng ra (2560x1080); StanbyME xoay dọc: 1280x2276.
   */
  function fit() {
    var de = document.documentElement;
    var w = root.innerWidth || de.clientWidth || 1920, h = root.innerHeight || de.clientHeight || 1080;
    var k = Math.min(w / MIN_W, h / BASE_H);
    if (Math.abs(k - 1) < 0.001) k = 1;
    var W = Math.ceil(w / k - 0.01), H = Math.ceil(h / k - 0.01);
    if (W === layout.W && H === layout.H && k === layout.k && layout.done) return;
    layout.W = W; layout.H = H; layout.k = k; layout.done = true;
    var st = document.getElementById('stage');
    st.style.width = W + 'px';
    st.style.height = H + 'px';
    st.style.transform = st.style.webkitTransform = k === 1 ? '' : 'scale(' + k + ')';
    for (var i = 0; i < layoutFns.length; i++) {
      try { layoutFns[i](layout); } catch (e) { if (root.console) console.error(e); }
    }
  }

  function onKeyDown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var code = e.keyCode, ae = document.activeElement, inInput = ae && ae.tagName === 'INPUT';
    if (inInput) {
      // Đang gõ: OK/Back kết thúc việc nhập; Lên/Xuống thoát ô nhập để di chuyển; phím còn lại để ô nhập tự xử lý
      if (code === 13 || code === 461 || code === 27) { ae.blur(); e.preventDefault(); return; }
      if (code === 38 || code === 40) ae.blur(); else return;
    }
    var k = KEYS[code];
    if (!k) return;
    if (MT.update.dialogOpen()) { if (MT.update.onKey(k)) e.preventDefault(); return; }   // hộp thoại cập nhật đè lên trên
    if (cur && cur.onKey && cur.onKey(k, e)) e.preventDefault();
  }

  /** Mở app là vào thẳng kênh xem gần nhất (như TiviMate). */
  function autoStart() {
    if (autoStarted || !D.channels.length) return;
    autoStarted = true;
    if (curName !== 'browse') return;
    var url = MT.prefs.lastChannelUrl, idx = -1;
    for (var i = 0; i < D.channels.length; i++) if (D.channels[i].url === url) { idx = i; break; }
    if (idx >= 0) openWatch(D.channels, idx);
  }

  function start() {
    fit();
    root.addEventListener('resize', fit);
    root.addEventListener('orientationchange', function () { setTimeout(fit, 300); });
    MT.player.init();
    MT.update.init();
    screens = { browse: MT.browse, watch: MT.watch, setup: MT.setup };
    for (var k in screens) screens[k].init();
    D.on('channels', autoStart);
    D.init();
    go(MT.prefs.playlistUrl ? 'browse' : 'setup');
    setInterval(function () { MT.browse.onTick(); MT.watch.onTick(); }, 30000);
    document.addEventListener('keydown', onKeyDown);
    if (root.MT_BOOT) root.MT_BOOT.ok();          // khởi động xong: bản đang chạy dùng được (xem js/boot.js)
    MT.update.check(true);                         // như bản Android: mở app là tự kiểm tra bản mới (ngầm)
  }

  MT.layout = layout;
  MT.app = { go: go, openWatch: openWatch, exit: exit, start: start, fit: fit, current: function () { return curName; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
