/* Mô hình bảng lịch phát sóng (chuyển từ GuideModel.kt và các hàm nowPlaying/nextPlaying). */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};

  var MINUTE = 60000, HALF_HOUR = 30 * MINUTE, HOUR = 60 * MINUTE;

  function floorTo(ms, step) { return ms - ms % step; }

  /**
   * Chia khoảng [from, to) của một kênh thành các ô liên tiếp:
   * chương trình có trong EPG thì thành một ô, khoảng trống chia thành các khối 1 giờ.
   * Ô có programme = null nghĩa là "Không có thông tin".
   */
  function buildCells(list, from, to) {
    var result = [], cursor = from;

    function fillGap(until) {
      while (cursor < until) {
        var end = Math.min((Math.floor(cursor / HOUR) + 1) * HOUR, until);
        result.push({ start: cursor, end: end, programme: null });
        cursor = end;
      }
    }

    if (list) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (p.stop <= cursor || p.start >= to) continue;
        if (p.start > cursor) fillGap(p.start);
        var end = Math.min(p.stop, to);
        result.push({ start: cursor, end: end, programme: p });
        cursor = end;
      }
    }
    if (cursor < to) fillGap(to);
    return result;
  }

  /** Danh sách chương trình của kênh (ghép theo tvg-id, không phân biệt hoa thường). */
  function progsFor(epg, ch) {
    if (!ch || !ch.id) return null;
    var k = ch.id.toLowerCase();
    return Object.prototype.hasOwnProperty.call(epg, k) ? epg[k] : null;
  }

  function nowPlaying(epg, ch, now) {
    var l = progsFor(epg, ch);
    if (!l) return null;
    for (var i = 0; i < l.length; i++) if (now >= l[i].start && now < l[i].stop) return l[i];
    return null;
  }

  function nextPlaying(epg, ch, now) {
    var l = progsFor(epg, ch);
    if (!l) return null;
    for (var i = 0; i < l.length; i++) if (l[i].start > now) return l[i];
    return null;
  }

  /** Chỉ số ô chứa thời điểm t (nếu không có thì lấy ô cuối). */
  function cellAt(cells, t) {
    for (var i = 0; i < cells.length; i++) if (t >= cells[i].start && t < cells[i].end) return i;
    return Math.max(0, cells.length - 1);
  }

  MT.guide = {
    MINUTE: MINUTE, HALF_HOUR: HALF_HOUR, HOUR: HOUR,
    floorTo: floorTo, buildCells: buildCells, progsFor: progsFor,
    nowPlaying: nowPlaying, nextPlaying: nextPlaying, cellAt: cellAt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.guide;
})(typeof window !== 'undefined' ? window : global);
