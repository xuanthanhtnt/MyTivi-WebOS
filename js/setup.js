/* Cài đặt: link playlist (.m3u / .m3u8), link EPG, proxy CORS tùy chọn, phiên bản + kiểm tra cập nhật (chuyển từ SetupScreen.kt). */
(function (root) {
  'use strict';
  var MT = root.MT, U = MT.util, D = MT.data, P = MT.player;

  var S = { items: [], i: 0, canCancel: false };
  var E = {}, FIELDS = { fUrl: 'suUrl', fEpg: 'suEpg', fProxy: 'suProxy' }, BUTTONS = { bSave: 1, bUpdate: 1, bCancel: 1 };

  function $(id) { return document.getElementById(id); }

  function init() {
    var ids = ['setup', 'suVer', 'suUrl', 'suEpg', 'suProxy', 'suErr', 'fUrl', 'fEpg', 'fProxy', 'bSave', 'bUpdate', 'bCancel'];
    for (var i = 0; i < ids.length; i++) E[ids[i]] = $(ids[i]);
    E.suVer.textContent = 'Phiên bản ' + U.VERSION;
    E.setup.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== E.setup) {
        if (t.id && (FIELDS[t.id] || BUTTONS[t.id])) {
          S.i = S.items.indexOf(t.id);
          if (S.i < 0) S.i = 0;
          applyFocus();
          activate();
          return;
        }
        t = t.parentNode;
      }
    });
  }

  function enter() {
    E.suUrl.value = MT.prefs.playlistUrl;
    E.suEpg.value = MT.prefs.epgUrl;
    E.suProxy.value = MT.prefs.proxy;
    E.suErr.textContent = '';
    S.canCancel = !!MT.prefs.playlistUrl;
    E.bCancel.classList.toggle('hide', !S.canCancel);
    S.items = ['fUrl', 'fEpg', 'fProxy', 'bSave', 'bUpdate'].concat(S.canCancel ? ['bCancel'] : []);
    S.i = 0;
    P.stop();
    P.setMode('off');
    E.setup.classList.remove('hide');
    applyFocus();
  }

  function leave() {
    var a = document.activeElement;
    if (a && a.blur) a.blur();
    E.setup.classList.add('hide');
  }

  function applyFocus() {
    var all = E.setup.querySelectorAll('.focus'), i;
    for (i = 0; i < all.length; i++) all[i].classList.remove('focus');
    $(S.items[S.i]).classList.add('focus');
  }

  function move(d) {
    S.i = U.clamp(S.i + d, 0, S.items.length - 1);
    applyFocus();
  }

  function activate() {
    var id = S.items[S.i];
    if (FIELDS[id]) E[FIELDS[id]].focus();                      // mở bàn phím ảo của TV
    else if (id === 'bSave') save();
    else if (id === 'bUpdate') MT.update.openDialog();
    else cancel();
  }

  function save() {
    var u = E.suUrl.value.trim(), e = E.suEpg.value.trim(), p = E.suProxy.value.trim(), err = null;
    if (!U.isHttp(u)) err = 'Link playlist phải bắt đầu bằng http:// hoặc https://';
    else if (e && !U.isHttp(e)) err = 'Link EPG phải bắt đầu bằng http:// hoặc https://';
    else if (p && !U.isHttp(p)) err = 'Proxy phải bắt đầu bằng http:// hoặc https://';
    E.suErr.textContent = err || '';
    if (err) return;
    if (u !== MT.prefs.playlistUrl || e !== MT.prefs.epgUrl || p !== MT.prefs.proxy) D.savePlaylist(u, e, p);
    MT.app.go('browse');
  }

  function cancel() {
    if (S.canCancel) MT.app.go('browse'); else MT.app.exit();
  }

  function onKey(k) {
    var id = S.items[S.i], onBtn = !!BUTTONS[id];
    switch (k) {
      case 'up': move(-1); return true;
      case 'down': move(+1); return true;
      case 'left': if (onBtn) move(-1); return true;
      case 'right': if (onBtn) move(+1); return true;
      case 'enter': activate(); return true;
      case 'back': cancel(); return true;
    }
    return false;
  }

  MT.setup = { init: init, enter: enter, leave: leave, onKey: onKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.setup;
})(typeof window !== 'undefined' ? window : global);
