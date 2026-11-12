/* Màn hình chính kiểu TiviMate: khung xem trước + thông tin chương trình ở trên,
 * thanh thời gian và bảng kênh/chương trình ở dưới, ngăn nhóm kênh ẩn bên trái (chuyển từ BrowseScreen.kt). */
(function (root) {
  'use strict';
  var MT = root.MT, U = MT.util, G = MT.guide, D = MT.data, P = MT.player;

  // ---- Kích thước bảng lịch (px @1920x1080, phải khớp css/app.css) ----
  var LEFT_W = 495, ROW_H = 87, PPM = 9.6, GUIDE_HOURS = 12, VIEW_W = 1329, VIEW_H = 652;
  var TOTAL_W = GUIDE_HOURS * 60 * PPM;          // 6912
  var MAX_SX = TOTAL_W - VIEW_W;

  var B = {
    sel: 1,            // 0 = Yêu thích, 1 = Tất cả, 2.. = nhóm
    query: '',
    groups: [], counts: [], shown: [],
    row: 0,
    col: -2,           // -2 = tên kênh, -1 = ngôi sao, >=0 = ô chương trình
    anchorT: 0,        // mốc thời gian để giữ cột khi bấm lên/xuống
    sx: 0,             // độ trượt ngang của bảng lịch (px)
    focusedUrl: null,
    previewUrl: null,
    drawer: false, di: 0,
    ws: 0, we: 0, now: 0,
    cellCache: {}
  };
  var E = {}, vl = null, previewTimer = null, visible = false;

  function $(id) { return document.getElementById(id); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function up(el, cls, stop) {
    while (el && el !== stop) {
      if (el.classList && el.classList.contains(cls)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function init() {
    var ids = ['browse', 'guide', 'guideInner', 'guideEmpty', 'pvMsg', 'pvSpin', 'infoEmpty', 'infoBody', 'iTitle', 'iTime',
      'iRange', 'iLive', 'iBar', 'iLeft', 'iChan', 'tlDate', 'tlStrip', 'tlArrow', 'drawer', 'dgQuery', 'dgSearch', 'dgList',
      'dgRefresh', 'dgSettings', 'dgLoad', 'dgStatus', 'dgVer', 'dgErr'];
    for (var i = 0; i < ids.length; i++) E[ids[i]] = $(ids[i]);
    vl = new MT.VList(E.guideInner, ROW_H, VIEW_H, makeRow);
    E.dgVer.textContent = 'Phiên bản ' + U.VERSION;

    D.on('channels', onChannels);
    D.on('epg', onEpg);
    D.on('favorites', onFavs);
    D.on('status', onStatus);
    P.on(function (what) { if (what === 'state' && visible && P.mode === 'pv') updatePvMsg(); });

    E.guide.addEventListener('click', onGuideClick);
    E.guide.addEventListener('wheel', onWheel);
    E.guide.addEventListener('error', function (e) {          // logo lỗi thì ẩn đi
      if (e.target && e.target.tagName === 'IMG') e.target.style.visibility = 'hidden';
    }, true);
    E.drawer.addEventListener('click', onDrawerClick);
    E.dgQuery.addEventListener('input', function () { B.query = E.dgQuery.value; recomputeShown(); });
    updateWindow(true);
  }

  /* ============================== Cửa sổ thời gian ============================== */

  /** Mốc đầu bảng lịch tự dời theo mỗi nửa giờ (TV mở cả ngày vẫn đúng giờ). Trả về true nếu cửa sổ đổi. */
  function updateWindow(force) {
    B.now = Date.now();
    var ws = G.floorTo(B.now, G.HALF_HOUR), changed = ws !== B.ws;
    B.ws = ws;
    B.we = ws + GUIDE_HOURS * G.HOUR;
    if (changed || force) {
      B.cellCache = {};
      var h = '';
      for (var n = 0; n < GUIDE_HOURS * 2; n++) {
        h += '<div class="tlh" style="left:' + Math.round(n * 30 * PPM) + 'px">' + U.hhmm(ws + n * G.HALF_HOUR) + '</div>';
      }
      E.tlStrip.innerHTML = h;
    }
    E.tlDate.textContent = U.dateShort(B.now);
    setSx(B.sx);
    return changed || !!force;
  }

  /** Trượt ngang: mọi hàng, thanh giờ và mũi tên "bây giờ" cùng di chuyển. */
  function setSx(v) {
    B.sx = U.clamp(v, 0, MAX_SX);
    var t = 'translate3d(' + (-B.sx) + 'px,0,0)', k;
    E.tlStrip.style.transform = t;
    for (k in vl.rows) vl.rows[k].children[1].firstChild.style.transform = t;
    var nowPx = (B.now - B.ws) / 60000 * PPM;
    E.tlArrow.style.transform = 'translate3d(' + Math.round(nowPx - B.sx - 11) + 'px,0,0)';
  }

  /* ============================== Dữ liệu hiển thị ============================== */

  function computeGroups() {
    var chs = D.channels, favs = D.favorites(), seen = Object.create(null), groups = [], byGroup = Object.create(null), favN = 0, i, c;
    for (i = 0; i < chs.length; i++) {
      c = chs[i];
      if (!(c.group in seen)) { seen[c.group] = 1; groups.push(c.group); byGroup[c.group] = 0; }
      byGroup[c.group]++;
      if (favs[c.url]) favN++;
    }
    B.groups = groups;
    B.counts = [favN, chs.length];
    for (i = 0; i < groups.length; i++) B.counts.push(byGroup[groups[i]]);
    if (B.sel >= B.counts.length) B.sel = 1;
  }

  function recomputeShown() {
    var chs = D.channels, favs = D.favorites(), base, i;
    if (B.sel === 0) {
      base = [];
      for (i = 0; i < chs.length; i++) if (favs[chs[i].url]) base.push(chs[i]);
    } else if (B.sel === 1) {
      base = chs;
    } else {
      var g = B.groups[B.sel - 2];
      base = [];
      for (i = 0; i < chs.length; i++) if (chs[i].group === g) base.push(chs[i]);
    }
    if (B.query && B.query.trim()) {
      var q = B.query.toLowerCase(), f = [];
      for (i = 0; i < base.length; i++) if (base[i].name.toLowerCase().indexOf(q) >= 0) f.push(base[i]);
      base = f;
    }
    B.shown = base;
    B.cellCache = {};
    vl.setCount(base.length);
    updateEmptyMsg();
  }

  function updateEmptyMsg() {
    var n = B.shown.length;
    E.guideEmpty.classList.toggle('hide', n > 0);
    if (!n) {
      E.guideEmpty.textContent = B.sel === 0 ? 'Chưa có kênh yêu thích. Bấm ngôi sao cạnh tên kênh (hoặc nút Vàng) để thêm.'
        : D.loading ? 'Đang tải danh sách kênh…' : 'Không có kênh nào.';
    }
  }

  function cellsOf(i) {
    if (!has(B.cellCache, i)) B.cellCache[i] = G.buildCells(G.progsFor(D.epg, B.shown[i]), B.ws, B.we);
    return B.cellCache[i];
  }

  function indexOfUrl(url) {
    if (!url) return -1;
    for (var i = 0; i < B.shown.length; i++) if (B.shown[i].url === url) return i;
    return -1;
  }

  /* ============================== Vẽ hàng ============================== */

  function makeRow(i) {
    var ch = B.shown[i], cells = cellsOf(i), now = B.now, h, k;
    var div = document.createElement('div');
    div.className = 'grow';
    div.setAttribute('data-i', i);
    h = '<div class="lc"><div class="nm"><span class="num">' + (i + 1) + '</span>' +
      (ch.logo ? '<img class="logo" src="' + U.esc(ch.logo) + '" alt="">' : '<span class="logo"></span>') +
      '<span class="name">' + U.esc(ch.name) + '</span></div>' +
      '<div class="st">' + U.star(D.isFavorite(ch)) + '</div></div>' +
      '<div class="cc"><div class="cells" style="transform:translate3d(' + (-B.sx) + 'px,0,0)">';
    for (k = 0; k < cells.length; k++) {
      var c = cells[k];
      var l = Math.round((c.start - B.ws) / 60000 * PPM), r = Math.round((c.end - B.ws) / 60000 * PPM);
      var cls = !c.programme ? 'none' : (now >= c.start && now < c.end) ? 'live' : '';
      h += '<div class="cell ' + cls + '" style="left:' + l + 'px;width:' + (r - l) + 'px"><span>' +
        U.esc(c.programme ? c.programme.title : 'Không có thông tin') + '</span></div>';
    }
    div.innerHTML = h + '</div></div>';
    if (i === B.row && !B.drawer && visible) markFocus(div, B.col);
    return div;
  }

  function clearFocus(div) {
    var f = div.querySelectorAll('.focus');
    for (var i = 0; i < f.length; i++) f[i].classList.remove('focus');
  }

  function markFocus(div, col) {
    clearFocus(div);
    var t = col === -2 ? div.querySelector('.nm') : col === -1 ? div.querySelector('.st') : div.querySelector('.cells').children[col];
    if (t) t.classList.add('focus');
  }

  function refreshRows() { vl.clear(); vl.render(); }

  /* ============================== Focus ============================== */

  function setFocus(row, col, jump, center) {
    var old = vl.row(B.row);
    if (old) clearFocus(old);
    B.row = row;
    B.col = col;
    vl.ensureVisible(row, !!center, !!jump);
    var el = vl.row(row);
    if (el) markFocus(el, col);
    if (col >= 0) ensureColVisible();
    onFocusChanged();
  }

  function ensureColVisible() {
    var c = cellsOf(B.row)[B.col];
    if (!c) return;
    var L = Math.round((c.start - B.ws) / 60000 * PPM), R = Math.round((c.end - B.ws) / 60000 * PPM), nsx = B.sx;
    if (L < nsx) nsx = L;
    else if (R > nsx + VIEW_W) nsx = Math.min(L, R - VIEW_W);
    if (nsx !== B.sx) setSx(nsx);
  }

  /** Đưa focus tới kênh đang xem (hoặc kênh xem gần nhất, hoặc kênh đầu tiên). */
  function restoreFocus() {
    if (!B.shown.length) {
      if (!B.focusedUrl) renderInfo(null, null);
      updatePvMsg();
      return;
    }
    var idx = indexOfUrl(B.focusedUrl);
    if (idx < 0) idx = indexOfUrl(MT.prefs.lastChannelUrl);
    if (idx < 0) idx = 0;
    setFocus(idx, -2, true, true);
  }

  function onFocusChanged() {
    var ch = B.shown[B.row];
    if (!ch) return;
    B.focusedUrl = ch.url;
    var prog;
    if (B.col >= 0) {
      var c = cellsOf(B.row)[B.col];
      prog = c ? c.programme : null;
    } else {
      prog = G.nowPlaying(D.epg, ch, Date.now());
    }
    renderInfo(ch, prog);
    schedulePreview(ch);
  }

  /* ============================== Thông tin + xem trước ============================== */

  function renderInfo(ch, prog) {
    E.infoEmpty.classList.toggle('hide', !!ch);
    E.infoBody.classList.toggle('hide', !ch);
    if (!ch) return;
    var now = Date.now();
    E.iTitle.textContent = prog ? prog.title : 'Không có thông tin';
    E.iTime.classList.toggle('hide', !prog);
    if (prog) {
      E.iRange.textContent = U.hhmm(prog.start) + ' – ' + U.hhmm(prog.stop);
      var live = now >= prog.start && now < prog.stop;
      E.iLive.classList.toggle('hide', !live);
      if (live) {
        E.iBar.style.width = (U.progress(prog, now) * 100) + '%';
        E.iLeft.textContent = 'còn ' + U.minutesLeft(prog, now) + ' phút';
      }
    }
    E.iChan.textContent = (B.row + 1) + '. ' + ch.name;
  }

  /** Lướt tới kênh nào thì khung xem trước chạy kênh đó (chờ 700ms để lướt nhanh không tải từng kênh). */
  function schedulePreview(ch) {
    if (B.previewUrl === ch.url) return;
    B.previewUrl = ch.url;
    clearTimeout(previewTimer);
    if (P.url === ch.url && P.state !== 'error') { updatePvMsg(); return; }     // vừa từ toàn màn hình về: đang chạy sẵn
    P.stop();
    updatePvMsg();
    previewTimer = setTimeout(function () { if (visible) P.play(ch.url); }, 700);
  }

  function updatePvMsg() {
    var s = P.state, msg = '', err = false;
    if (!B.focusedUrl) msg = 'Chọn một kênh để xem trước';
    else if (s === 'error') { msg = 'Không xem trước được kênh này'; err = true; }
    E.pvMsg.textContent = msg;
    E.pvMsg.classList.toggle('err', err);
    E.pvSpin.classList.toggle('hide', !(B.focusedUrl && s === 'loading'));
  }

  /* ============================== Sự kiện dữ liệu ============================== */

  function onChannels() {
    if (!visible) return;
    computeGroups();
    var prev = B.focusedUrl;
    recomputeShown();
    renderStatus();
    if (B.drawer) { renderDrawerList(); return; }
    var idx = indexOfUrl(prev);
    if (idx >= 0) setFocus(idx, B.col < 0 ? B.col : -2, true, true);
    else restoreFocus();
  }

  function onEpg() {
    B.cellCache = {};
    if (!visible) return;
    refreshRows();
    if (B.shown.length && !B.drawer) onFocusChanged();
  }

  function onFavs() {
    if (!visible) return;
    computeGroups();
    if (B.drawer) renderDrawerList();
    if (B.sel === 0) {
      var row = B.row, col = B.col < 0 ? B.col : -2;
      recomputeShown();
      if (B.shown.length && !B.drawer) setFocus(U.clamp(row, 0, B.shown.length - 1), col, true, false);
    } else {
      refreshRows();
    }
  }

  function onStatus() {
    if (!visible) return;
    renderStatus();
    updateEmptyMsg();
  }

  /** Gọi mỗi 30 giây: dời cửa sổ thời gian, cập nhật vạch "bây giờ" và thanh tiến độ. */
  function onTick() {
    if (!visible) return;
    var changed = updateWindow(false);
    refreshRows();
    if (B.shown.length && !B.drawer) {
      if (changed && B.col >= 0) B.col = G.cellAt(cellsOf(B.row), B.anchorT);
      var el = vl.row(B.row);
      if (el) markFocus(el, B.col);
      onFocusChanged();
    }
  }

  /* ============================== Ngăn nhóm kênh ============================== */

  function labelHtml(i) {
    return i === 0 ? U.star(true) + 'Yêu thích' : i === 1 ? 'Tất cả' : U.esc(B.groups[i - 2]);
  }

  function renderDrawerList() {
    var h = '';
    for (var i = 0; i < B.counts.length; i++) {
      h += '<div class="dg' + (i === B.sel ? ' sel' : '') + '" data-i="' + i + '"><span class="t">' + labelHtml(i) +
        '</span><span class="c">' + B.counts[i] + '</span></div>';
    }
    E.dgList.innerHTML = h;
    if (B.drawer) applyDrawerFocus();
  }

  function renderStatus() {
    var upd = D.lastUpdated > 0 ? ' · cập nhật ' + U.hhmm(D.lastUpdated) : '';
    E.dgStatus.textContent = D.channels.length + ' kênh' + upd;
    E.dgRefresh.textContent = D.loading ? 'Đang làm mới…' : 'Làm mới';
    E.dgLoad.classList.toggle('hide', !D.loading);
    E.dgErr.textContent = D.error || '';
  }

  function drawerEl(di) {
    var g = B.counts.length;
    if (di === 0) return E.dgSearch;
    if (di <= g) return E.dgList.children[di - 1];
    return di === g + 1 ? E.dgRefresh : E.dgSettings;
  }

  function applyDrawerFocus() {
    var f = E.drawer.querySelectorAll('.focus'), i;
    for (i = 0; i < f.length; i++) f[i].classList.remove('focus');
    var t = drawerEl(B.di);
    if (!t) return;
    t.classList.add('focus');
    if (B.di >= 1 && B.di <= B.counts.length) {                // giữ mục đang chọn trong vùng nhìn thấy
      var L = E.dgList, top = t.offsetTop, bot = top + t.offsetHeight;
      if (top < L.scrollTop) L.scrollTop = top;
      else if (bot > L.scrollTop + L.clientHeight) L.scrollTop = bot - L.clientHeight;
    }
  }

  function selectGroup(i) {
    if (B.sel === i) return;
    B.sel = i;
    var c = E.dgList.children;
    for (var k = 0; k < c.length; k++) c[k].classList.toggle('sel', k === i);
    recomputeShown();                                           // đi tới nhóm nào, danh sách kênh đổi theo nhóm đó
  }

  function openDrawer() {
    B.drawer = true;
    E.dgQuery.value = B.query;
    computeGroups();
    renderDrawerList();
    renderStatus();
    B.di = 1 + B.sel;
    var row = vl.row(B.row);
    if (row) clearFocus(row);
    E.drawer.classList.add('open');
    applyDrawerFocus();
  }

  function closeDrawer() {
    B.drawer = false;
    E.drawer.classList.remove('open');
    E.dgQuery.blur();
    restoreFocus();
  }

  function moveDrawer(n) {
    var total = B.counts.length + 3;
    n = U.clamp(n, 0, total - 1);
    if (n === B.di) return;
    B.di = n;
    if (n >= 1 && n <= B.counts.length) selectGroup(n - 1);
    applyDrawerFocus();
  }

  function activateDrawer() {
    var g = B.counts.length;
    if (B.di === 0) E.dgQuery.focus();
    else if (B.di <= g) closeDrawer();
    else if (B.di === g + 1) D.refresh();
    else MT.app.go('setup');
  }

  function drawerKey(k) {
    switch (k) {
      case 'up': moveDrawer(B.di - 1); return true;
      case 'down': moveDrawer(B.di + 1); return true;
      case 'right': case 'back': case 'green': closeDrawer(); return true;
      case 'enter': activateDrawer(); return true;
      case 'left': return true;
    }
    return false;
  }

  /* ============================== Phím điều khiển ============================== */

  function colFor(newRow) {
    return B.col >= 0 ? G.cellAt(cellsOf(newRow), B.anchorT) : B.col;
  }

  function toggleFav() {
    var ch = B.shown[B.row];
    if (ch) D.toggleFavorite(ch);
  }

  function play() {
    if (B.shown[B.row]) MT.app.openWatch(B.shown, B.row);
  }

  function onKey(k) {
    if (B.drawer) return drawerKey(k);
    var n = B.shown.length, r, cells, c, vt;
    switch (k) {
      case 'up':                                     // cuộn vòng: ở kênh đầu bấm lên về kênh cuối
        if (n) { r = B.row <= 0 ? n - 1 : B.row - 1; setFocus(r, colFor(r)); }
        return true;
      case 'down':
        if (n) { r = B.row >= n - 1 ? 0 : B.row + 1; setFocus(r, colFor(r)); }
        return true;
      case 'chUp': case 'chDown':
        if (n) {
          r = U.clamp(B.row + (k === 'chUp' ? -vl.page() : vl.page()), 0, n - 1);
          setFocus(r, colFor(r));
        }
        return true;
      case 'left':
        if (!n) { openDrawer(); return true; }
        if (B.col > 0) {
          c = B.col - 1;
          B.anchorT = cellsOf(B.row)[c].start;
          setFocus(B.row, c);
        } else if (B.col === 0) setFocus(B.row, -1);
        else if (B.col === -1) setFocus(B.row, -2);
        else openDrawer();                           // đang ở cột tên kênh: bấm Trái mở ngăn nhóm kênh
        return true;
      case 'right':
        if (!n) return true;
        if (B.col === -2) setFocus(B.row, -1);
        else if (B.col === -1) {
          cells = cellsOf(B.row);
          vt = B.ws + B.sx / PPM * 60000;            // thời điểm ở mép trái vùng đang nhìn thấy
          c = G.cellAt(cells, vt + 1);
          B.anchorT = Math.max(cells[c].start, vt);
          setFocus(B.row, c);
        } else {
          cells = cellsOf(B.row);
          if (B.col < cells.length - 1) {
            c = B.col + 1;
            B.anchorT = cells[c].start;
            setFocus(B.row, c);
          }
        }
        return true;
      case 'enter':
        if (n) { if (B.col === -1) toggleFav(); else play(); }
        return true;
      case 'yellow': toggleFav(); return true;
      case 'green': openDrawer(); return true;
      case 'red': D.refresh(); return true;
      case 'blue': MT.app.go('setup'); return true;
      case 'back': MT.app.exit(); return true;
    }
    return false;
  }

  /* ============================== Chuột / Magic Remote ============================== */

  function onGuideClick(e) {
    if (B.drawer) return;
    var rowEl = up(e.target, 'grow', E.guide);
    if (!rowEl) return;
    var i = +rowEl.getAttribute('data-i');
    if (up(e.target, 'st', rowEl)) { setFocus(i, -1); toggleFav(); return; }
    var cell = up(e.target, 'cell', rowEl);
    if (cell) {
      var col = Array.prototype.indexOf.call(cell.parentNode.children, cell);
      B.anchorT = cellsOf(i)[col].start;
      setFocus(i, col);
    } else {
      setFocus(i, -2);
    }
    play();
  }

  function onWheel(e) {
    if (B.drawer || !visible) return;
    e.preventDefault();
    onKey(e.deltaY > 0 ? 'down' : 'up');
  }

  function onDrawerClick(e) {
    var dg = up(e.target, 'dg', E.drawer);
    if (dg) { selectGroup(+dg.getAttribute('data-i')); closeDrawer(); return; }
    if (up(e.target, 'dg-search', E.drawer)) { E.dgQuery.focus(); return; }
    if (e.target === E.dgRefresh) D.refresh();
    else if (e.target === E.dgSettings) MT.app.go('setup');
  }

  /* ============================== Vào / ra màn hình ============================== */

  function enter() {
    visible = true;
    E.browse.classList.remove('hide');
    P.setMode('pv');
    B.previewUrl = null;
    B.focusedUrl = null;       // như Android: rời màn hình rồi quay lại thì focus về kênh xem gần nhất
    B.drawer = false;
    E.drawer.classList.remove('open');
    updateWindow(true);
    computeGroups();
    recomputeShown();
    renderStatus();
    restoreFocus();
    updatePvMsg();
  }

  function leave() {
    visible = false;
    clearTimeout(previewTimer);
    E.dgQuery.blur();
    E.browse.classList.add('hide');
  }

  MT.browse = { init: init, enter: enter, leave: leave, onKey: onKey, onTick: onTick, _state: B };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.browse;
})(typeof window !== 'undefined' ? window : global);
