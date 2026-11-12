/* Trạng thái dữ liệu: kênh, yêu thích, EPG, cache và tự cập nhật (chuyển từ MainViewModel.kt). */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};
  var prefs = MT.prefs, cache = MT.cache, net = MT.net;

  // Chỉnh các mốc này nếu muốn cập nhật thưa hoặc dày hơn
  var PLAYLIST_TTL_MS = 3 * 3600000;   // tải lại playlist sau 3 giờ
  var EPG_TTL_MS = 6 * 3600000;        // tải lại EPG sau 6 giờ
  var CHECK_EVERY_MS = 15 * 60000;     // cứ 15 phút kiểm tra một lần

  var listeners = {};
  var generation = 0;      // mỗi lượt tải playlist có số riêng; lượt cũ bị bỏ qua khi có lượt mới
  var epgGen = 0;
  var epgCached = false;

  var D = {
    channels: [],
    epg: {},
    loading: false,
    error: null,
    lastUpdated: prefs.playlistTime,

    on: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit: function (ev) {
      var l = listeners[ev] || [];
      for (var i = 0; i < l.length; i++) {
        try { l[i](); } catch (e) { if (root.console) console.error(e); }
      }
    },

    favorites: function () { return prefs.favorites; },
    isFavorite: function (ch) { return !!prefs.favorites[ch.url]; },

    toggleFavorite: function (ch) {
      var cur = prefs.favorites, next = {}, k;
      for (k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) next[k] = true;
      if (next[ch.url]) delete next[ch.url]; else next[ch.url] = true;
      prefs.favorites = next;
      D.emit('favorites');
    },

    /** Mở app: hiện ngay dữ liệu đã lưu (kênh + EPG), rồi cập nhật từ mạng. */
    init: function () {
      if (prefs.playlistUrl) {
        cache.get('playlist').then(function (text) {
          if (text) {
            try { D.channels = MT.m3u.parseText(text, prefs.playlistUrl).channels; } catch (e) { D.channels = []; }
            D.emit('channels');
          }
          return cache.get('epg');
        }).then(function (e) {
          epgCached = !!(e && e.map);
          return loadEpg({ cacheOnly: true });
        }).then(function () {
          startRefresh(false);
        });
      }
      // Vòng lặp tự cập nhật: TV để mở nhiều ngày vẫn luôn có dữ liệu mới
      setInterval(D.tick, CHECK_EVERY_MS);
      var onVis = function () { if (!(document.hidden || document.webkitHidden)) D.tick(); };
      document.addEventListener('visibilitychange', onVis);
      document.addEventListener('webkitvisibilitychange', onVis);
    },

    tick: function () {
      if (!prefs.playlistUrl) return;
      if (Date.now() - prefs.playlistTime > PLAYLIST_TTL_MS) startRefresh(false);
      else if (epgStale()) loadEpg({});
    },

    savePlaylist: function (url, epgUrl, proxy) {
      prefs.playlistUrl = url;
      prefs.epgUrl = epgUrl;
      prefs.proxy = proxy || '';
      D.channels = [];
      D.epg = {};
      D.emit('channels');
      D.emit('epg');
      startRefresh(true);
    },

    /** Nút "Làm mới": tải lại playlist và EPG. Đang tải dở thì bỏ qua. */
    refresh: function () {
      if (D.loading) return;
      startRefresh(true);
    }
  };

  function currentEpgUrl() { return prefs.epgUrl || prefs.autoEpgUrl; }

  function epgStale() {
    var u = currentEpgUrl();
    return !!u && (!epgCached || prefs.epgSource !== u || Date.now() - prefs.epgTime > EPG_TTL_MS);
  }

  /** forceEpg = true: tải lại cả EPG; tự động thì chỉ tải EPG khi đã cũ. */
  function startRefresh(forceEpg) {
    var url = prefs.playlistUrl;
    if (!url) return;
    var gen = ++generation;
    D.loading = true;
    D.error = null;
    D.emit('status');

    net.getText(url, { timeout: 60000 }).then(function (text) {
      if (gen !== generation) return null;                  // lượt này đã bị thay thế
      return cache.set('playlist', text).then(function () {
        if (gen !== generation) return null;
        var parsed = MT.m3u.parseText(text, url);
        D.channels = parsed.channels;
        prefs.autoEpgUrl = parsed.epgUrl || '';
        prefs.playlistTime = Date.now();
        D.lastUpdated = prefs.playlistTime;
        if (!parsed.channels.length) D.error = 'Playlist không có kênh nào.';
        D.emit('channels');
        if (forceEpg || epgStale()) loadEpg({ force: forceEpg });
      });
    }).catch(function (e) {
      if (gen === generation) D.error = 'Không tải được playlist: ' + (e && e.message ? e.message : e);
    }).then(function () {
      if (gen === generation) { D.loading = false; D.emit('status'); }
    });
  }

  function readCachedEpg() {
    return cache.get('epg').then(function (e) { return e && e.map ? e.map : null; });
  }

  /**
   * EPG được lưu cache nên lần mở app sau có lịch ngay, không phải tải lại.
   * cacheOnly = true: chỉ đọc bản đã lưu (không dùng mạng).
   */
  function loadEpg(o) {
    var url = currentEpgUrl();
    if (!url) return Promise.resolve();
    if (o.cacheOnly && !epgCached) return Promise.resolve();
    var job = ++epgGen;

    var p;
    if (!o.cacheOnly && (o.force || epgStale())) {
      p = net.get(url, { timeout: 120000 }).then(function (buf) {
        if (job !== epgGen) return null;
        return MT.epg.parse(buf, Date.now());
      }).then(function (map) {
        if (!map || job !== epgGen) return null;
        return cache.set('epg', { source: url, time: Date.now(), map: map }).then(function () {
          prefs.epgSource = url;
          prefs.epgTime = Date.now();
          epgCached = true;
          return map;
        });
      }).catch(function (err) {
        // Tải lỗi thì dùng tạm bản cũ (nếu có), 15 phút sau sẽ thử lại
        if (!epgCached) throw err;
        return readCachedEpg();
      });
    } else {
      p = readCachedEpg();
    }
    return p.then(function (map) {
      if (map && job === epgGen) { D.epg = map; D.emit('epg'); }
    }).catch(function () { /* EPG lỗi thì bỏ qua, vẫn xem kênh bình thường */ });
  }

  MT.data = D;
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : global);
