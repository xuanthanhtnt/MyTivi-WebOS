/* Xem kênh toàn màn hình (chuyển từ PlayerScreen.kt).
 *  Lên / CH+ : kênh kế tiếp      Xuống / CH- : kênh trước đó
 *  OK / Trái / Phải : mở danh sách kênh      Vàng : thêm/bỏ yêu thích
 *  INFO : hiện lại thanh thông tin           BACK : đóng danh sách, hoặc quay về màn hình chính */
(function (root) {
  'use strict';
  var MT = root.MT, U = MT.util, G = MT.guide, D = MT.data, P = MT.player;

  var ROW_H = 90, PANEL_PAD = 18, NBSP3 = '   ';   // PANEL_PAD: lề trên/dưới của #chView (khớp css/app.css)
  var ERR_NAMES = { 1: 'MEDIA_ERR_ABORTED', 2: 'MEDIA_ERR_NETWORK', 3: 'MEDIA_ERR_DECODE', 4: 'MEDIA_ERR_SRC_NOT_SUPPORTED' };

  var W = { list: [], index: 0, panel: false, pf: 0, err: null, hadInfo: false };
  var infoTimer = null, retryTimer = null, switchTimer = null;
  var E = {}, vl = null, visible = false;

  function $(id) { return document.getElementById(id); }
  function up(el, cls, stop) {
    while (el && el !== stop) {
      if (el.classList && el.classList.contains(cls)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function init() {
    var ids = ['watch', 'wSpin', 'wErr', 'infoBar', 'ibNum', 'ibLogo', 'ibName', 'ibNow', 'ibBarWrap', 'ibBar', 'ibNext',
      'ibBadges', 'ibTime', 'ibDate', 'chPanel', 'chInner'];
    for (var i = 0; i < ids.length; i++) E[ids[i]] = $(ids[i]);
    vl = new MT.VList(E.chInner, ROW_H, MT.layout.H - 2 * PANEL_PAD, makeRow);
    MT.layout.on(function (L) {                     // đổi kích thước / xoay màn hình: bảng chọn kênh cao theo
      vl.setViewH(L.H - 2 * PANEL_PAD);
      if (visible && W.panel) vl.ensureVisible(W.pf, false, true);
    });

    P.on(function (what) {
      if (!visible) return;
      if (what === 'state') onState(); else onInfo();
    });
    D.on('favorites', function () { if (visible) renderBar(); });
    E.watch.addEventListener('click', onClick);
    E.watch.addEventListener('wheel', onWheel);
    E.ibLogo.addEventListener('error', function () { E.ibLogo.style.visibility = 'hidden'; });
  }

  function enter(arg) {
    visible = true;
    W.list = arg.list;
    W.index = U.clamp(arg.index, 0, arg.list.length - 1);
    W.panel = false;
    E.watch.classList.remove('hide');
    E.chPanel.classList.add('hide');
    P.setMode('full');
    startChannel();
  }

  function leave() {
    visible = false;
    clearTimeout(infoTimer);
    clearTimeout(retryTimer);
    clearTimeout(switchTimer);
    E.infoBar.classList.remove('show');
    E.watch.classList.add('hide');
  }

  /* ---------- Chọn kênh ---------- */

  function startChannel() {
    var ch = W.list[W.index];
    W.hadInfo = false;
    hideError();
    clearTimeout(retryTimer);
    renderBar();
    showBar();
    clearTimeout(switchTimer);
    // Đổi kênh: chờ 250ms để bấm liên tục không làm máy chủ bị gọi dồn dập
    var same = P.url === ch.url && P.state !== 'error';
    switchTimer = setTimeout(function () {
      if (!visible) return;
      MT.prefs.lastChannelUrl = ch.url;
      P.play(ch.url);
      updateSpinner();
    }, same ? 0 : 250);
    updateSpinner();
  }

  function move(step) {
    var n = W.list.length;
    W.index = (W.index + step + n) % n;
    startChannel();
  }

  /* ---------- Trạng thái phát ---------- */

  function showError(msg) { W.err = msg; E.wErr.textContent = msg; E.wErr.classList.remove('hide'); }
  function hideError() { W.err = null; E.wErr.classList.add('hide'); }
  function updateSpinner() { E.wSpin.classList.toggle('hide', !(P.state === 'loading' && !W.err)); }

  function onState() {
    var ch = W.list[W.index];
    if (P.url !== ch.url) { updateSpinner(); return; }          // chưa kịp chuyển sang kênh mới
    if (P.state === 'error') {
      showError('Không phát được kênh này (' + (ERR_NAMES[P.errorCode] || P.errorCode) + ')');
      // Lỗi mạng / mất luồng: tự thử lại sau 5 giây
      clearTimeout(retryTimer);
      retryTimer = setTimeout(function () { if (visible && P.state === 'error') P.reload(); }, 5000);
    } else if (P.state === 'playing') {
      hideError();
      clearTimeout(retryTimer);
    }
    updateSpinner();
  }

  /** Khi đọc được thông số luồng (thường sau 1-2 giây) thì hiện lại thanh thông tin cho đủ thời gian xem. */
  function onInfo() {
    renderBadges();
    if (!W.hadInfo && P.url === W.list[W.index].url && P.getInfo()) { W.hadInfo = true; showBar(); }
  }

  /* ---------- Thanh thông tin ---------- */

  function renderBar() {
    var ch = W.list[W.index], now = Date.now();
    var np = G.nowPlaying(D.epg, ch, now), nx = G.nextPlaying(D.epg, ch, now);
    E.ibNum.textContent = W.index + 1;
    if (ch.logo) { E.ibLogo.style.visibility = 'visible'; E.ibLogo.src = ch.logo; }
    else { E.ibLogo.style.visibility = 'hidden'; E.ibLogo.removeAttribute('src'); }
    E.ibName.innerHTML = U.esc(ch.name) + (D.isFavorite(ch) ? U.star(true) : '');
    E.ibNow.classList.toggle('hide', !np);
    E.ibBarWrap.classList.toggle('hide', !np);
    if (np) {
      E.ibNow.textContent = U.hhmm(np.start) + ' – ' + U.hhmm(np.stop) + NBSP3 + np.title;
      E.ibBar.style.width = (U.progress(np, now) * 100) + '%';
    }
    E.ibNext.classList.toggle('hide', !nx);
    if (nx) E.ibNext.textContent = 'Tiếp theo: ' + U.hhmm(nx.start) + '  ' + nx.title;
    E.ibTime.textContent = U.hhmm(now);
    E.ibDate.textContent = U.dateLong(now);
    renderBadges();
  }

  function renderBadges() {
    var ch = W.list[W.index], info = P.url === ch.url ? P.getInfo() : null, h = '';
    if (info) {
      var b = P.badges(info);
      for (var i = 0; i < b.length; i++) {
        h += '<span class="b' + (i === 0 && info.height > 0 ? ' strong' : '') + '">' + U.esc(b[i]) + '</span>';
      }
    }
    E.ibBadges.innerHTML = h;
  }

  function showBar() {
    if (W.panel) return;
    E.infoBar.classList.add('show');
    clearTimeout(infoTimer);
    infoTimer = setTimeout(function () { E.infoBar.classList.remove('show'); }, 5000);
  }

  function onTick() {
    if (visible) renderBar();
  }

  /* ---------- Bảng chọn kênh ---------- */

  function makeRow(i) {
    var ch = W.list[i], np = G.nowPlaying(D.epg, ch, Date.now());
    var d = document.createElement('div');
    d.className = 'pr' + (i === W.index ? ' cur' : '') + (i === W.pf ? ' focus' : '');
    d.setAttribute('data-i', i);
    d.innerHTML = '<span class="pn">' + (i + 1) + '</span><div class="pc"><div class="pname">' + U.esc(ch.name) + '</div>' +
      (np ? '<div class="pprog">' + U.esc(np.title) + '</div>' : '') + '</div>';
    return d;
  }

  function openPanel() {
    W.panel = true;
    W.pf = W.index;
    E.infoBar.classList.remove('show');
    E.chPanel.classList.remove('hide');
    vl.setCount(W.list.length);
    vl.ensureVisible(W.pf, true, true);
  }

  function closePanel() {
    W.panel = false;
    E.chPanel.classList.add('hide');
  }

  function movePanel(i) {
    var n = W.list.length, old = vl.row(W.pf);
    i = ((i % n) + n) % n;                                      // cuộn vòng: cuối -> đầu, đầu -> cuối
    if (old) old.classList.remove('focus');
    W.pf = i;
    vl.ensureVisible(i, false, false);
    var el = vl.row(i);
    if (el) el.classList.add('focus');
  }

  function pick(i) {
    W.index = i;
    closePanel();
    startChannel();
  }

  function panelKey(k) {
    switch (k) {
      case 'up': movePanel(W.pf - 1); return true;
      case 'down': movePanel(W.pf + 1); return true;
      case 'chUp': movePanel(Math.max(0, W.pf - vl.page())); return true;
      case 'chDown': movePanel(Math.min(W.list.length - 1, W.pf + vl.page())); return true;
      case 'enter': pick(W.pf); return true;
      case 'back': closePanel(); return true;
      case 'left': case 'right': return true;
    }
    return false;
  }

  /* ---------- Phím điều khiển ---------- */

  function onKey(k) {
    if (W.panel) return panelKey(k);
    switch (k) {
      case 'up': case 'chUp': move(+1); return true;
      case 'down': case 'chDown': move(-1); return true;
      case 'enter': case 'left': case 'right': openPanel(); return true;
      case 'yellow': D.toggleFavorite(W.list[W.index]); showBar(); return true;
      case 'info': renderBar(); showBar(); return true;
      case 'back': MT.app.go('browse'); return true;
    }
    return false;
  }

  function onClick(e) {
    if (W.panel) {
      var r = up(e.target, 'pr', E.chPanel);
      if (r) pick(+r.getAttribute('data-i'));
      else if (!up(e.target, 'ch-panel', E.watch)) closePanel();
    } else {
      openPanel();
    }
  }

  function onWheel(e) {
    if (W.panel) return;
    e.preventDefault();
    move(e.deltaY > 0 ? -1 : +1);
  }

  MT.watch = { init: init, enter: enter, leave: leave, onKey: onKey, onTick: onTick, _state: W };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.watch;
})(typeof window !== 'undefined' ? window : global);
