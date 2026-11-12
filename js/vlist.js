/* Danh sách ảo hóa: chỉ tạo các hàng đang nhìn thấy (playlist có thể có hàng nghìn kênh).
 * Chiều cao hàng cố định; việc cuộn do mã điều khiển (không dùng thanh cuộn của trình duyệt). */
(function (root) {
  'use strict';
  var MT = root.MT = root.MT || {};

  /**
   * inner: phần tử chứa các hàng (position:absolute; có transition transform trong CSS)
   * rowH, viewH: chiều cao một hàng / chiều cao vùng nhìn thấy (px)
   * make(i): trả về phần tử DOM của hàng thứ i
   */
  function VList(inner, rowH, viewH, make) {
    this.inner = inner;
    this.rowH = rowH;
    this.h = viewH;
    this.make = make;
    this.count = 0;
    this.top = 0;
    this.rows = {};
  }

  VList.prototype.maxTop = function () { return Math.max(0, this.count * this.rowH - this.h); };

  VList.prototype.setCount = function (n) {
    this.count = n;
    this.inner.style.height = (n * this.rowH) + 'px';
    this.top = Math.min(this.top, this.maxTop());
    this.clear();
    this.render();
  };

  VList.prototype.clear = function () {
    for (var k in this.rows) {
      var el = this.rows[k];
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this.rows = {};
  };

  VList.prototype.render = function () {
    var first = Math.max(0, Math.floor(this.top / this.rowH) - 2);
    var last = Math.min(this.count - 1, Math.ceil((this.top + this.h) / this.rowH) + 1);
    var k, i;
    for (k in this.rows) {
      i = +k;
      if (i < first || i > last) {
        var old = this.rows[k];
        if (old.parentNode) old.parentNode.removeChild(old);
        delete this.rows[k];
      }
    }
    for (i = first; i <= last; i++) {
      if (!this.rows[i]) {
        var el = this.make(i);
        el.style.top = (i * this.rowH) + 'px';
        this.inner.appendChild(el);
        this.rows[i] = el;
      }
    }
    this.inner.style.transform = 'translate3d(0,' + (-this.top) + 'px,0)';
  };

  /** Cuộn tới vị trí top mới; nhảy xa thì bỏ hiệu ứng trượt cho đỡ rối mắt. */
  VList.prototype.scrollTo = function (newTop, instant) {
    newTop = Math.max(0, Math.min(this.maxTop(), newTop));
    if (newTop === this.top) return;
    var jump = instant || Math.abs(newTop - this.top) > this.h;
    this.top = newTop;
    if (jump) this.inner.style.transition = 'none';
    this.render();
    if (jump) {
      void this.inner.offsetHeight;                 // ép trình duyệt áp dụng ngay
      this.inner.style.transition = '';
    }
  };

  /** Đảm bảo hàng i nằm trong vùng nhìn thấy (center = đặt giữa vùng nhìn). */
  VList.prototype.ensureVisible = function (i, center, instant) {
    var y = i * this.rowH, t = this.top;
    if (center) t = y - (this.h - this.rowH) / 2;
    else if (y < t) t = y;
    else if (y + this.rowH > t + this.h) t = y + this.rowH - this.h;
    this.scrollTo(t, instant);
  };

  VList.prototype.row = function (i) { return this.rows[i] || null; };
  VList.prototype.page = function () { return Math.max(1, Math.floor(this.h / this.rowH) - 1); };

  MT.VList = VList;
  if (typeof module !== 'undefined' && module.exports) module.exports = VList;
})(typeof window !== 'undefined' ? window : global);
