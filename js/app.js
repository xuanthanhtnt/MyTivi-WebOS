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

  var screens = {}, cur = null, curName = null, autoStarted = false;

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

  /** Phóng/thu bố cục 1920x1080 cho vừa cửa sổ (trên TV là đúng 1920x1080 nên không cần phóng). */
  function fit() {
    var st = document.getElementById('stage');
    var k = Math.min(root.innerWidth / 1920, root.innerHeight / 1080);
    if (Math.abs(k - 1) < 0.001) {
      st.style.transform = '';
      st.style.left = st.style.top = '0px';
    } else {
      st.style.transform = 'scale(' + k + ')';
      st.style.left = Math.round((root.innerWidth - 1920 * k) / 2) + 'px';
      st.style.top = Math.round((root.innerHeight - 1080 * k) / 2) + 'px';
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
    MT.player.init();
    screens = { browse: MT.browse, watch: MT.watch, setup: MT.setup };
    for (var k in screens) screens[k].init();
    D.on('channels', autoStart);
    D.init();
    go(MT.prefs.playlistUrl ? 'browse' : 'setup');
    setInterval(function () { MT.browse.onTick(); MT.watch.onTick(); }, 30000);
    document.addEventListener('keydown', onKeyDown);
  }

  MT.app = { go: go, openWatch: openWatch, exit: exit, start: start, current: function () { return curName; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
