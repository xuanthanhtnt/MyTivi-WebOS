/* Lưu cài đặt (localStorage) và bộ nhớ đệm playlist/EPG (IndexedDB) – thay cho Prefs.kt và file cache của bản Android. */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};

  var ls = null, mem = {}, memc = {};
  try { ls = root.localStorage || null; } catch (e) { ls = null; }

  function get(k, d) {
    try {
      var v = ls ? ls.getItem('mytivi.' + k) : mem[k];
      return v == null ? d : v;
    } catch (e) { return d; }
  }
  function set(k, v) {
    v = String(v);
    try { if (ls) ls.setItem('mytivi.' + k, v); else mem[k] = v; } catch (e) { mem[k] = v; }
  }

  var favs = null;

  var prefs = {
    /** Link playlist .m3u / .m3u8 */
    get playlistUrl() { return get('playlistUrl', ''); },
    set playlistUrl(v) { set('playlistUrl', v); },
    /** Link EPG người dùng tự nhập (ưu tiên hơn link EPG ghi sẵn trong playlist). */
    get epgUrl() { return get('epgUrl', ''); },
    set epgUrl(v) { set('epgUrl', v); },
    /** Link EPG đọc từ dòng #EXTM3U url-tvg="..." của playlist. */
    get autoEpgUrl() { return get('autoEpgUrl', ''); },
    set autoEpgUrl(v) { set('autoEpgUrl', v); },
    /** Link EPG của bản cache hiện có (để biết khi nào phải tải lại). */
    get epgSource() { return get('epgSource', ''); },
    set epgSource(v) { set('epgSource', v); },
    get playlistTime() { return +get('playlistTime', '0') || 0; },
    set playlistTime(v) { set('playlistTime', v); },
    get epgTime() { return +get('epgTime', '0') || 0; },
    set epgTime(v) { set('epgTime', v); },
    get lastChannelUrl() { return get('lastChannel', ''); },
    set lastChannelUrl(v) { set('lastChannel', v); },
    /** Tiền tố proxy (tùy chọn) cho nguồn không cho phép truy cập chéo miền (CORS). */
    get proxy() { return get('proxy', ''); },
    set proxy(v) { set('proxy', v); },

    /** Kênh yêu thích: { [url kênh]: true } */
    get favorites() {
      if (!favs) {
        favs = {};
        try {
          var a = JSON.parse(get('favorites', '[]'));
          for (var i = 0; i < a.length; i++) favs[a[i]] = true;
        } catch (e) { favs = {}; }
      }
      return favs;
    },
    set favorites(obj) {
      favs = obj;
      set('favorites', JSON.stringify(Object.keys(obj)));
    }
  };

  /* ---- IndexedDB: playlist (chuỗi lớn) và EPG đã phân tích ---- */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      try {
        var req = root.indexedDB.open('mytivi', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbp;
  }

  var cache = {
    get: function (key) {
      return db().then(function (d) {
        if (!d) return Object.prototype.hasOwnProperty.call(memc, key) ? memc[key] : null;
        return new Promise(function (res) {
          try {
            var r = d.transaction('kv', 'readonly').objectStore('kv').get(key);
            r.onsuccess = function () { res(r.result == null ? null : r.result); };
            r.onerror = function () { res(null); };
          } catch (e) { res(null); }
        });
      });
    },
    set: function (key, val) {
      return db().then(function (d) {
        if (!d) { memc[key] = val; return true; }
        return new Promise(function (res) {
          try {
            var tx = d.transaction('kv', 'readwrite');
            tx.objectStore('kv').put(val, key);
            tx.oncomplete = function () { res(true); };
            tx.onerror = tx.onabort = function () { memc[key] = val; res(false); };
          } catch (e) { memc[key] = val; res(false); }
        });
      });
    }
  };

  MT.prefs = prefs;
  MT.cache = cache;
  if (typeof module !== 'undefined' && module.exports) module.exports = { prefs: prefs, cache: cache };
})(typeof window !== 'undefined' ? window : global);
