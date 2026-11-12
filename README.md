# MyTivi cho webOS TV

Bản chuyển của [MyTivi (Android TV)](https://github.com/xuanthanhtnt/MyTivi) sang **LG webOS TV**: phát playlist M3U / luồng HLS (.m3u8), điều khiển bằng remote, giao diện kiểu TiviMate. Viết bằng HTML/CSS/JS thuần (không cần build), phát video bằng thẻ `<video>` gốc của webOS.

> Chỉ dùng với nội dung bạn có quyền xem. App không kèm sẵn playlist nào.

## Tính năng (đối chiếu với bản Android)

| Bản Android | Bản webOS |
|---|---|
| Thêm playlist bằng link .m3u hoặc 1 link .m3u8 | Có (màn Cài đặt) |
| Nhóm kênh (group-title), logo, tìm kiếm, yêu thích | Có |
| Màn hình lịch kiểu TiviMate: xem trước + bảng kênh/chương trình, mũi tên "bây giờ" | Có |
| Lướt tới kênh nào thì khung xem trước tự chạy kênh đó (có tiếng) | Có |
| Ngăn nhóm kênh ẩn bên trái (Trái mở, Phải đóng; Làm mới, Cài đặt ở cuối ngăn) | Có |
| EPG XMLTV, hỗ trợ `.gz`; ghép theo `tvg-id` | Có (đọc theo khối, chỉ giữ -2h..+24h) |
| Xem toàn màn hình: đổi kênh, danh sách kênh, thanh thông tin 5 giây, tự thử lại sau 5 giây khi mất luồng | Có |
| Thanh thông tin: chất lượng SD/HD/FHD/4K, độ phân giải, fps, codec, bitrate | Có một phần, xem "Hạn chế" |
| Tự cập nhật playlist 3 giờ, EPG 6 giờ, kiểm tra mỗi 15 phút; cache để mở app là có kênh ngay | Có (IndexedDB) |
| Cuộn vòng danh sách kênh; mở app vào thẳng kênh xem gần nhất; dừng tiếng khi ra Home | Có |
| Tự cập nhật app qua GitHub Releases | **Không** (webOS không cài APK; cập nhật = cài lại file .ipk) |

## Phím điều khiển

| Phím | Màn hình chính | Đang xem toàn màn hình |
|---|---|---|
| OK | Xem toàn màn hình (ở ngôi sao: thêm/bỏ yêu thích) | Mở danh sách kênh |
| Trái (ở cột tên kênh) / Xanh lá | Mở ngăn nhóm kênh | Mở danh sách kênh |
| Phải (trong ngăn) | Đóng ngăn nhóm kênh | |
| Lên / Xuống | Đổi kênh (cuộn vòng) | Lên: kênh kế, Xuống: kênh trước |
| CH+ / CH- | Nhảy một trang | Kênh kế / kênh trước |
| Vàng | Thêm/bỏ yêu thích | Thêm/bỏ yêu thích |
| Đỏ | Làm mới playlist + EPG | |
| Xanh dương | Cài đặt | |
| INFO | | Hiện lại thanh thông tin |
| Back | Thoát app (hoặc đóng ngăn) | Đóng danh sách / về màn hình chính |

Magic Remote (con trỏ): bấm vào kênh/ô chương trình để xem, con lăn để đổi kênh.

## Cài lên TV

Cần TV LG webOS (làm cho webOS 4.0 / 2018 trở lên) và bật **Developer Mode**:

1. Trên TV: cài app **Developer Mode** từ LG Content Store, đăng nhập tài khoản LG Developer, bật *Dev Mode Status* và *Key Server*. Ghi lại IP của TV và passphrase.
2. Trên máy tính cài [ares-cli](https://webostv.developer.lge.com/develop/tools/cli-installation) của LG (`npm i -g @webos-tools/cli`), rồi:

```bash
ares-setup-devicelist                         # thêm TV: tên "tv", IP của TV, cổng 9922, user prisoner
ares-novacom --device tv --getkey             # nhập passphrase hiển thị trong app Developer Mode
ares-install --device tv dist/com.mytivi.webos_1.0.0_all.ipk
ares-launch  --device tv com.mytivi.webos
```

Muốn dùng giao diện đồ họa thay cho dòng lệnh thì có thể dùng công cụ cộng đồng *Dev Manager* của webosbrew. Phiên Developer Mode của TV thường hết hạn sau một thời gian; mở app Developer Mode và gia hạn (Extend) khi cần.

Lần đầu mở app sẽ vào màn **Cài đặt**: dán link playlist (và link EPG nếu muốn). Gõ link dài bằng remote khá mất công: có thể gõ bằng bàn phím Bluetooth/USB hoặc dùng giọng nói của Magic Remote.

### CORS khi tải playlist/EPG

Web app tải playlist bằng XHR nên phụ thuộc việc máy chủ có cho phép truy cập chéo miền (CORS) hay không. Nếu báo "Không kết nối được máy chủ (lỗi mạng hoặc bị chặn CORS)" dù link vẫn mở được trên máy tính, điền ô **Proxy CORS** trong Cài đặt: tiền tố proxy mà link sẽ được nối vào sau (ví dụ `https://proxy-cua-ban.example/?url=`), hoặc dạng có `{url}` ở giữa. Chỉ dùng proxy do bạn tin cậy/tự dựng vì nó nhìn thấy link playlist của bạn. Video không bị ảnh hưởng vì thẻ `<video>` phát trực tiếp không qua CORS.

## Hạn chế đã biết

- **Chưa thử trên TV thật** (môi trường dựng không có TV). Đã kiểm thử logic bằng Node (8 test) và giao diện bằng Chrome headless (47 bước: cài đặt, điều hướng remote, ngăn nhóm, yêu thích, xem toàn màn hình, kênh lỗi, mở lại từ cache) cùng ảnh chụp 1920×1080. Hành vi phụ thuộc phần cứng/firmware (bo góc video xem trước, định dạng codec, độ trễ chuyển kênh) cần bạn xác nhận trên TV.
- **Không có hls.js**: chỉ phát bằng bộ phát gốc của webOS (HLS, MPEG-TS, MP4...). Nguồn dùng giao thức webOS không hỗ trợ (rtmp://, udp://, rtsp://) sẽ báo lỗi.
- **Khung xem trước chạy chất lượng gốc** của luồng (bản Android giới hạn 854×480 bằng ExoPlayer). Nhiều TV chỉ có một bộ giải mã phần cứng, nên app dùng đúng một thẻ `<video>` và chuyển nó giữa khung xem trước và toàn màn hình.
- **Thông số luồng**: độ phân giải đọc từ video; fps được ước lượng sau vài giây; codec và bitrate chỉ hiện khi đọc được playlist HLS gốc có `CODECS`/`BANDWIDTH` (máy chủ phải cho phép CORS).
- Không hỗ trợ header riêng kiểu `url|User-Agent=...` (giống bản Android). Kênh không có `tvg-id` khớp EPG hiện "Không có thông tin".
- Chưa có: nhập số kênh bằng phím số, ghi hình, catch-up, multiview, khóa phụ huynh, Xtream Codes, nhiều playlist (giống bản Android).

## Phát triển

```bash
node --test test/core.test.js            # test phần lõi (parser M3U/EPG, ô lịch)
python3 test/ui_smoke.py ./shots         # test giao diện bằng Chrome headless + ảnh chụp (cần playwright, Chrome, ffmpeg)
python3 tools/build_ipk.py               # tạo dist/com.mytivi.webos_<phiên bản>_all.ipk
```

Thử nhanh trên máy tính: phục vụ thư mục này bằng một web server bất kỳ rồi mở `index.html` bằng Chrome (Esc = Back, PageUp/PageDown = CH+/CH-, F = Vàng, I = Info). Chrome máy tính không phát HLS gốc nên chỉ thử được luồng mp4/webm.

Code cố ý viết theo ES2015 (không `async/await`, `?.`, `flex gap`, CSS grid...) để chạy được trên Chromium cũ của webOS 4/5.

| Bản Android | Bản webOS |
|---|---|
| `M3uParser.kt`, `EpgParser.kt`, `GuideModel.kt` | `js/m3u.js`, `js/epg.js`, `js/guide.js` |
| `Http.kt`, `Prefs.kt` | `js/net.js`, `js/store.js` |
| `MainViewModel.kt` | `js/data.js` |
| `PlayerFactory.kt`, `StreamInfo.kt` | `js/player.js` |
| `BrowseScreen.kt` (+ `Components.kt`) | `js/browse.js`, `js/vlist.js`, `css/app.css` |
| `PlayerScreen.kt` | `js/watch.js` |
| `SetupScreen.kt`, `MainActivity.kt` | `js/setup.js`, `js/app.js` |
| `Updater.kt`, `UpdateDialog.kt`, `UpdateViewModel.kt` | (không chuyển) |

Chỉnh tần suất tự cập nhật ở đầu `js/data.js` (`PLAYLIST_TTL_MS`, `EPG_TTL_MS`, `CHECK_EVERY_MS`); kích thước bảng lịch ở đầu `js/browse.js` và `css/app.css` (cột kênh 495px, hàng 87px, 9.6px/phút, 12 giờ).

## Giấy phép bên thứ ba

`js/lib/pako.es5.min.js`: [pako](https://github.com/nodeca/pako) 2.1.0 (MIT và Zlib), dùng để giải nén EPG `.gz`. Xem `js/lib/pako.LICENSE.txt`.
