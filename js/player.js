/* Trình phát dùng chung cho cả khung xem trước và toàn màn hình.
 * Chỉ dùng MỘT thẻ <video>: nhiều TV LG chỉ có một bộ giải mã phần cứng, nên không thể có hai player chạy cùng lúc.
 * webOS phát HLS (.m3u8) và MPEG-TS trực tiếp qua thẻ <video> (thay cho ExoPlayer của bản Android). */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};

  var el = null, listeners = [], resumeUrl = null;
  var probeToken = 0, fpsTimer = null, variants = [];

  var P = {
    url: null,
    state: 'idle',        // idle | loading | playing | error
    errorCode: null,
    mode: 'off',          // off | pv (khung xem trước) | full (toàn màn hình)
    fps: 0,

    on: function (fn) { listeners.push(fn); },

    init: function () {
      el = document.getElementById('vid');
      var ev = {
        loadstart: function () { if (P.url) setState('loading'); },
        waiting: function () { if (P.url && P.state !== 'error') setState('loading'); },
        playing: function () { if (P.url) { setState('playing'); startFpsProbe(); } },
        error: onError,
        ended: function () { if (P.url) setState('error', 'ended'); },
        loadedmetadata: emitInfo,
        resize: emitInfo
      };
      for (var k in ev) el.addEventListener(k, ev[k]);

      // Bấm Home / TV tắt màn hình thì dừng phát (tránh còn tiếng chạy ngầm); quay lại thì phát tiếp
      var onVis = function () {
        if (document.hidden || document.webkitHidden) {
          if (P.url) { resumeUrl = P.url; P.stop(); }
        } else if (resumeUrl) {
          var u = resumeUrl;
          resumeUrl = null;
          P.play(u, true);                       // kênh live: nhảy về điểm trực tiếp
        }
      };
      document.addEventListener('visibilitychange', onVis);
      document.addEventListener('webkitvisibilitychange', onVis);
      if (MT.layout) MT.layout.on(place);          // đổi kích thước / xoay màn hình
    },

    setMode: function (m) {
      P.mode = m;
      el.className = m === 'pv' ? 'pv' : m === 'full' ? 'full' : 'off';
      place();
    },

    play: function (url, force) {
      if (!force && url === P.url && P.state !== 'error') return;
      resetStream();
      P.url = url;
      setState('loading');
      try { el.pause(); } catch (e) { /* bỏ qua */ }
      el.removeAttribute('src');
      el.load();
      el.src = url;
      var pr = el.play();
      if (pr && pr.catch) pr.catch(function () { /* autoplay bị chặn / bị hủy khi đổi kênh */ });
      startProbe(url);
    },

    reload: function () { if (P.url) P.play(P.url, true); },

    stop: function () {
      resetStream();
      P.url = null;
      if (el) {
        try { el.pause(); } catch (e) { /* bỏ qua */ }
        el.removeAttribute('src');
        el.load();
      }
      setState('idle');
    },

    /** Thông số luồng: { width, height, fps, vcodec, acodec, channels, bitrate } hoặc null khi chưa có. */
    getInfo: function () {
      if (!P.url || !el) return null;
      var w = el.videoWidth || 0, h = el.videoHeight || 0;
      var v = pickVariant(h);
      var info = {
        width: w, height: h,
        fps: P.fps || (v && v.fps) || 0,
        vcodec: v ? v.vcodec : null,
        acodec: v ? v.acodec : null,
        channels: 0,
        bitrate: v ? v.bandwidth : 0
      };
      return (w || h || info.vcodec || info.acodec) ? info : null;
    },

    /** Các nhãn hiển thị, ví dụ: FHD · 1920×1080 · 50 fps · H.264 · AAC · 4.2 Mbps */
    badges: function (info) {
      var out = [];
      if (info.height > 0) {
        out.push(info.height >= 2160 ? '4K' : info.height >= 1440 ? '2K' : info.height >= 1080 ? 'FHD' : info.height >= 720 ? 'HD' : 'SD');
        if (info.width > 0) out.push(info.width + '×' + info.height);
      }
      if (info.fps > 0) out.push(Math.round(info.fps) + ' fps');
      if (info.vcodec) out.push(info.vcodec);
      if (info.acodec) {
        var ch = info.channels === 1 ? ' Mono' : info.channels === 2 ? ' 2.0' : info.channels === 6 ? ' 5.1' : info.channels === 8 ? ' 7.1' : '';
        out.push(info.acodec + ch);
      }
      if (info.bitrate > 0) out.push((info.bitrate / 1000000).toFixed(1) + ' Mbps');
      return out;
    },

    /** Tên codec đọc từ thuộc tính CODECS của m3u8 (ví dụ "avc1.640028,mp4a.40.2"). */
    codecNames: codecNames,
    parseMaster: parseMaster
  };

  /**
   * Thẻ video nằm ngoài #stage nên toạ độ là px thật của cửa sổ: khung xem trước lấy đúng vị trí #pv (đã phóng/thu
   * theo màn hình); toàn màn hình thì để CSS phủ cả cửa sổ. Không dùng transform cho video để lớp video phần cứng
   * của TV luôn trùng khung.
   */
  function place() {
    var s = el.style, pv = document.getElementById('pv');
    if (P.mode === 'pv' && pv) {
      var r = pv.getBoundingClientRect(), k = MT.layout ? MT.layout.k : 1;
      s.left = Math.round(r.left) + 'px';
      s.top = Math.round(r.top) + 'px';
      s.width = Math.round(r.width) + 'px';
      s.height = Math.round(r.height) + 'px';
      s.borderRadius = Math.round(30 * k) + 'px';
    } else {
      s.left = s.top = s.width = s.height = s.borderRadius = '';
    }
  }

  function setState(s, code) {
    P.state = s;
    P.errorCode = code || null;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i]('state'); } catch (e) { if (root.console) console.error(e); }
    }
  }

  function emitInfo() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i]('info'); } catch (e) { if (root.console) console.error(e); }
    }
  }

  function onError() {
    // Gỡ nguồn (removeAttribute('src')) cũng có thể sinh lỗi "empty src": bỏ qua
    if (!P.url || !el.getAttribute('src')) return;
    var c = el.error ? el.error.code : 0;
    setState('error', c || 'unknown');
  }

  function resetStream() {
    probeToken++;
    variants = [];
    P.fps = 0;
    clearTimeout(fpsTimer);
    fpsTimer = null;
  }

  /* ---- Ước lượng fps bằng cách đếm số khung hình đã giải mã ---- */
  function frames() {
    if (el.getVideoPlaybackQuality) return el.getVideoPlaybackQuality().totalVideoFrames;
    return el.webkitDecodedFrameCount || 0;
  }

  function startFpsProbe() {
    if (P.fps || fpsTimer) return;
    var t0 = Date.now(), f0 = frames(), token = probeToken;
    fpsTimer = setTimeout(function () {
      fpsTimer = null;
      if (token !== probeToken || P.state !== 'playing') return;
      var dt = (Date.now() - t0) / 1000, df = frames() - f0;
      if (dt > 1 && df > 0) {
        var f = df / dt, snaps = [24, 25, 30, 50, 60];
        for (var i = 0; i < snaps.length; i++) if (Math.abs(f - snaps[i]) / snaps[i] < 0.08) { f = snaps[i]; break; }
        P.fps = f;
        emitInfo();
      }
    }, 3000);
  }

  /* ---- Đọc thông số (độ phân giải/codec/bitrate) từ playlist HLS gốc, nếu máy chủ cho phép ---- */
  function codecNames(codecs) {
    var out = { v: null, a: null }, parts = String(codecs || '').split(',');
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].trim().toLowerCase();
      if (/^avc[13]/.test(c)) out.v = 'H.264';
      else if (/^(hvc1|hev1)/.test(c)) out.v = 'H.265';
      else if (/^av01/.test(c)) out.v = 'AV1';
      else if (/^vp0?9/.test(c)) out.v = 'VP9';
      else if (/^mp4a\.40/.test(c)) out.a = 'AAC';
      else if (/^mp4a\.6b|^mp4a\.69|^mp3/.test(c)) out.a = 'MP3';
      else if (/^ac-3/.test(c)) out.a = 'AC3';
      else if (/^ec-3/.test(c)) out.a = 'E-AC3';
      else if (/^opus/.test(c)) out.a = 'Opus';
    }
    return out;
  }

  function parseMaster(text) {
    var out = [], lines = String(text).split(/\r\n|\n|\r/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('#EXT-X-STREAM-INF:') !== 0) continue;
      var bw = /BANDWIDTH=(\d+)/.exec(line), res = /RESOLUTION=(\d+)x(\d+)/.exec(line);
      var fr = /FRAME-RATE=([\d.]+)/.exec(line), cd = /CODECS="([^"]*)"/.exec(line);
      var names = codecNames(cd ? cd[1] : '');
      out.push({
        bandwidth: bw ? +bw[1] : 0,
        width: res ? +res[1] : 0,
        height: res ? +res[2] : 0,
        fps: fr ? +fr[1] : 0,
        vcodec: names.v,
        acodec: names.a
      });
    }
    return out;
  }

  function startProbe(url) {
    if (!/m3u8/i.test(url) || !MT.net) return;
    var token = probeToken;
    MT.net.getText(url, { timeout: 8000 }).then(function (text) {
      if (token !== probeToken) return;
      variants = parseMaster(text);
      if (variants.length) emitInfo();
    }).catch(function () { /* máy chủ chặn CORS hoặc lỗi: bỏ qua, chỉ không có thông số codec/bitrate */ });
  }

  function pickVariant(h) {
    if (!variants.length) return null;
    var i;
    for (i = 0; i < variants.length; i++) if (h && variants[i].height === h) return variants[i];
    return variants.length === 1 ? variants[0] : null;
  }

  MT.player = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : global);
