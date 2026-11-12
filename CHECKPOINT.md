# CHECKPOINT – MyTivi cho webOS TV

Trạng thái: **đã hoàn tất mã + đóng gói; chưa thử trên TV thật.**

Nguồn: https://github.com/xuanthanhtnt/MyTivi (Android TV, Kotlin/Compose) -> web app webOS (HTML/CSS/JS thuần).

## Đã xong và đã kiểm thử
- Mã: js/*.js, css/app.css, index.html, appinfo.json, icon.png, largeIcon.png, tools/build_ipk.py, README.md
- `node --test test/core.test.js`: 8/8 pass
- `python3 test/ui_smoke.py <thư_mục_ảnh>`: 47/47 pass (Chrome headless, ảnh chụp 1920x1080)
- `python3 tools/build_ipk.py --schema <ApplicationDescription.schema>`: appinfo hợp lệ; `dpkg-deb -I` đọc được IPK
- Kết quả: dist/com.mytivi.webos_1.0.0_all.ipk

## Giới hạn (đã ghi trong README)
- Không có hls.js (npm registry và API GitHub bị chặn trong môi trường dựng) -> chỉ phát bằng <video> gốc của webOS.
- ares-cli không cài được -> IPK tự đóng gói theo mã nguồn ares-cli (lib/package.js).
- Chưa thử trên TV thật: CORS khi tải playlist/EPG (có ô Proxy), bo góc video, codec, độ trễ chuyển kênh.
- Không có tự cập nhật qua GitHub Releases.

## Việc tiếp theo (nếu cần)
- Cài thử trên TV, báo lại lỗi cụ thể (kèm đời TV/phiên bản webOS).
- Có thể thêm: nhập số kênh bằng phím số, hls.js dự phòng (cần lấy được thư viện).
