# CHECKPOINT – MyTivi cho webOS TV

Trạng thái: **1.1.0 – co giãn mọi màn hình + cập nhật trong app; đã phát hành lên GitHub; chưa thử trên TV thật.**

- Nguồn: https://github.com/xuanthanhtnt/MyTivi (Android TV, Kotlin/Compose) -> web app webOS (HTML/CSS/JS thuần).
- Repo: https://github.com/xuanthanhtnt/MyTivi-WebOS (nhánh `main`; push là Actions build + tạo Release `v<phiên bản>`).
- Quay lại bản trước khi sửa: `git checkout checkpoint-1.0.0`.

## 1.1.0 (so với 1.0.0)
- Co giãn theo cửa sổ thật thay vì đặt cứng 1920x1080 (TV Full HD chỉ cho web app 1280x720): lấp kín mọi tỉ lệ
  (16:9, 16:10, 4:3, 21:9, StanbyME dọc), video đặt theo toạ độ thật, bảng lịch/bảng chọn kênh tính lại khi đổi kích thước.
- Cập nhật trong app như bản Android: tự kiểm tra khi mở, nút trong ngăn nhóm kênh + Cài đặt, hộp thoại Cập nhật ngay /
  Khởi động lại; tải mã bản mới từ GitHub (`js/update.js`), nạp khi mở app (`js/boot.js`), tự quay về bản .ipk nếu lỗi.
- GitHub Actions `.github/workflows/build-ipk.yml`; `test/dev_server.py` để thử trên máy tính.

## Đã kiểm thử
- `node --test test/core.test.js`: 17/17 pass.
- Trình duyệt (pane Claude, Chromium): 1920x1080, 1280x720, 1080x1920, 2560x1080, 1024x768, 1920x1200 – video trùng khung
  xem trước, không tràn; ngăn nhóm, hộp thoại cập nhật, xem toàn màn hình, Cài đặt; trọn luồng cập nhật với bản giả 1.2.0.
- `python3 tools/build_ipk.py`: kiểm tra khớp phiên bản và đóng gói được.
- Chưa chạy lại `test/ui_smoke.py` (máy dựng không có playwright/Chrome/ffmpeg); đã thêm mục 10 kiểm tra nhiều độ phân giải.

## Việc tiếp theo (nếu cần)
- Cài thử trên TV, báo lại lỗi cụ thể (kèm đời TV/phiên bản webOS), nhất là: bố cục trên TV Full HD, gọi GitHub (HTTPS) trên webOS 4.
- Có thể thêm: nhập số kênh bằng phím số, hls.js dự phòng.
