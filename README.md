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
| Ngăn nhóm kênh ẩn bên trái (Trái mở, Phải đóng; Làm mới, Cài đặt, Kiểm tra cập nhật ở cuối ngăn) | Có |
| EPG XMLTV, hỗ trợ `.gz`; ghép theo `tvg-id` | Có (đọc theo khối, chỉ giữ -2h..+24h) |
| Xem toàn màn hình: đổi kênh, danh sách kênh, thanh thông tin 5 giây, tự thử lại sau 5 giây khi mất luồng | Có |
| Thanh thông tin: chất lượng SD/HD/FHD/4K, độ phân giải, fps, codec, bitrate | Có một phần, xem "Hạn chế" |
| Tự cập nhật playlist 3 giờ, EPG 6 giờ, kiểm tra mỗi 15 phút; cache để mở app là có kênh ngay | Có (IndexedDB) |
| Cuộn vòng danh sách kênh; mở app vào thẳng kênh xem gần nhất; dừng tiếng khi ra Home | Có |
| Cập nhật app qua GitHub Releases: tự kiểm tra khi mở, nút "Kiểm tra cập nhật" trong ngăn và Cài đặt, nút đổi màu khi có bản mới, "Cập nhật ngay" | Có, xem [Cập nhật app](#cập-nhật-app-ngay-trên-tv) |
| (chỉ có trên webOS) Co giãn theo mọi kích thước/tỉ lệ màn hình | Có, xem [Màn hình](#màn-hình-và-độ-phân-giải) |

## Phím điều khiển

| Phím | Màn hình chính | Đang xem toàn màn hình |
|---|---|---|
| OK | Xem toàn màn hình (ở ngôi sao: thêm/bỏ yêu thích) | Mở danh sách kênh |
| Trái (ở cột tên kênh) / Xanh lá | Mở ngăn nhóm kênh | Mở danh sách kênh |
| Phải (trong ngăn) | Đóng ngăn nhóm kênh | |
| Lên / Xuống | Đổi kênh (cuộn vòng) | Lên: kênh kế, Xuống: kênh trước |
| CH+ / CH- | Nhảy một trang | Kênh kế / kênh trước |
| Vàng (bản Android: MENU) | Thêm/bỏ yêu thích | Thêm/bỏ yêu thích |
| Đỏ | Làm mới playlist + EPG | |
| Xanh dương | Cài đặt | |
| INFO | | Hiện lại thanh thông tin |
| Back | Thoát app (hoặc đóng ngăn / hộp thoại) | Đóng danh sách / về màn hình chính |

Magic Remote (con trỏ): bấm vào kênh/ô chương trình để xem, con lăn để đổi kênh.

## Cài lên TV

Cần TV LG webOS (làm cho webOS 4.0 / 2018 trở lên) và bật **Developer Mode**:

1. Trên TV: cài app **Developer Mode** từ LG Content Store, đăng nhập tài khoản LG Developer, bật *Dev Mode Status* và *Key Server*. Ghi lại IP của TV và passphrase.
2. Tải file cài bản mới nhất: **https://github.com/xuanthanhtnt/MyTivi-WebOS/releases/latest/download/MyTivi.ipk**
3. Trên máy tính cài [ares-cli](https://webostv.developer.lge.com/develop/tools/cli-installation) của LG (`npm i -g @webos-tools/cli`), rồi:

```bash
ares-setup-devicelist                         # thêm TV: tên "tv", IP của TV, cổng 9922, user prisoner
ares-novacom --device tv --getkey             # nhập passphrase hiển thị trong app Developer Mode
ares-install --device tv MyTivi.ipk
ares-launch  --device tv com.mytivi.webos
```

Muốn dùng giao diện đồ họa thay cho dòng lệnh thì có thể dùng công cụ cộng đồng *Dev Manager* của webosbrew. Phiên Developer Mode của TV thường hết hạn sau một thời gian; mở app Developer Mode và gia hạn (Extend) khi cần (hết hạn thì TV gỡ các app cài theo cách này, phải cài lại).

Lần đầu mở app sẽ vào màn **Cài đặt**: dán link playlist (và link EPG nếu muốn). Gõ link dài bằng remote khá mất công: có thể gõ bằng bàn phím Bluetooth/USB hoặc dùng giọng nói của Magic Remote.

## Cập nhật app ngay trên TV

Giống bản Android, nhưng theo cách của webOS (webOS không cho app tự cài file .ipk):

- Mở app là tự kiểm tra ngầm bản phát hành mới nhất trên GitHub. Có bản mới thì nút **Cập nhật** trong ngăn nhóm kênh đổi màu xanh và dưới khung thông tin có dòng nhắc.
- Bấm Trái mở ngăn > **Cập nhật lên bản …** (hoặc Cài đặt > **Kiểm tra cập nhật**) > **Cập nhật ngay**: app tải mã (HTML/CSS/JS) của bản đó từ GitHub, lưu trong TV, rồi bấm **Khởi động lại** là dùng bản mới. Chọn *Để sau* thì lần mở app tới tự dùng.
- An toàn: bản tải về mà làm app không khởi động được 2 lần liền thì tự bỏ, quay về bản đã cài từ .ipk. Cài một file .ipk mới hơn thì bản tải về cũ tự bị bỏ.
- Bản phát hành thay đổi phần lõi (`js/boot.js`, `appinfo.json`, icon, tăng `mytivi-boot`) thì không cập nhật kiểu này được: hộp thoại sẽ báo cần cài lại `MyTivi.ipk`.
- Repo phải để **Public** để app đọc được bản phát hành (GitHub API giới hạn 60 lượt kiểm tra/giờ cho mỗi IP, thừa cho vài TV).

### Phát hành bản mới (người phát triển)

1. Sửa mã, rồi tăng phiên bản ở **cả 3 nơi** (phải khớp nhau, `tools/build_ipk.py` và test sẽ báo nếu lệch):
   `appinfo.json` (`version`), `index.html` (`<meta name="mytivi-version">`), `js/util.js` (`VERSION`).
2. Push lên nhánh `main`. GitHub Actions (`.github/workflows/build-ipk.yml`) chạy test, đóng gói và tạo Release `v<phiên bản>` kèm `MyTivi.ipk`; nội dung commit cuối thành ghi chú bản phát hành (hiện trong hộp thoại cập nhật trên TV).
3. Push mà không đổi phiên bản thì chỉ build, không tạo Release (TV không thấy gì mới).

## Màn hình và độ phân giải

Theo tài liệu của LG, web app trên TV **4K** có vùng vẽ 1920×1080, trên TV **Full HD** chỉ có 1280×720 (video vẫn phát độ phân giải gốc). App không đặt cứng kích thước mà tự co giãn theo cửa sổ thật (`window.innerWidth/innerHeight`):

| Màn hình | Cửa sổ app | Bố cục (px thiết kế) |
|---|---|---|
| TV 4K / 8K, StanbyME ngang | 1920×1080 | 1920×1080, giữ nguyên |
| TV Full HD | 1280×720 | 1920×1080, thu 2/3 |
| Màn 16:10 / 4:3 | ví dụ 1920×1200 / 1024×768 | 1728×1080 / 1440×1080 |
| Màn 21:9 | 2560×1080 | 2560×1080 (bảng lịch rộng thêm) |
| StanbyME xoay dọc (`supportPortraitMode`) | 1080×1920 | 1280×2276 (nhiều hàng kênh hơn) |

Mọi khối neo theo cạnh màn hình nên lấp kín, không viền đen. Thẻ video nằm ngoài khối được phóng/thu và đặt theo toạ độ thật, để lớp video phần cứng của TV luôn trùng khung xem trước.

## CORS khi tải playlist/EPG

Web app tải playlist bằng XHR nên phụ thuộc việc máy chủ có cho phép truy cập chéo miền (CORS) hay không. Nếu báo "Không kết nối được máy chủ (lỗi mạng hoặc bị chặn CORS)" dù link vẫn mở được trên máy tính, điền ô **Proxy CORS** trong Cài đặt: tiền tố proxy mà link sẽ được nối vào sau (ví dụ `https://proxy-cua-ban.example/?url=`), hoặc dạng có `{url}` ở giữa. Chỉ dùng proxy do bạn tin cậy/tự dựng vì nó nhìn thấy link playlist của bạn. Video không bị ảnh hưởng vì thẻ `<video>` phát trực tiếp không qua CORS. Việc kiểm tra/tải bản cập nhật từ GitHub không đi qua proxy.

## Hạn chế đã biết

- **Chưa thử trên TV thật** (môi trường dựng không có TV). Đã kiểm thử logic bằng Node (17 test: parser, ô lịch, đọc bản phát hành, nạp bản cập nhật và tự quay về khi lỗi) và giao diện bằng trình duyệt ở 1920×1080, 1280×720, 1080×1920, 2560×1080, 1024×768, 1920×1200, cùng toàn bộ luồng cập nhật với một bản phát hành giả. Hành vi phụ thuộc phần cứng/firmware (bo góc video xem trước, định dạng codec, độ trễ chuyển kênh, chứng chỉ HTTPS khi gọi GitHub trên TV đời cũ) cần bạn xác nhận trên TV.
- **Không có hls.js**: chỉ phát bằng bộ phát gốc của webOS (HLS, MPEG-TS, MP4...). Nguồn dùng giao thức webOS không hỗ trợ (rtmp://, udp://, rtsp://) sẽ báo lỗi.
- **Khung xem trước chạy chất lượng gốc** của luồng (bản Android giới hạn 854×480 bằng ExoPlayer). Nhiều TV chỉ có một bộ giải mã phần cứng, nên app dùng đúng một thẻ `<video>` và chuyển nó giữa khung xem trước và toàn màn hình.
- **Thông số luồng**: độ phân giải đọc từ video; fps được ước lượng sau vài giây; codec và bitrate chỉ hiện khi đọc được playlist HLS gốc có `CODECS`/`BANDWIDTH` (máy chủ phải cho phép CORS).
- Không hỗ trợ header riêng kiểu `url|User-Agent=...` (giống bản Android). Kênh không có `tvg-id` khớp EPG hiện "Không có thông tin".
- Chưa có: nhập số kênh bằng phím số, ghi hình, catch-up, multiview, khóa phụ huynh, Xtream Codes, nhiều playlist (giống bản Android).

## Phát triển

```bash
node --test test/core.test.js            # test phần lõi (parser M3U/EPG, ô lịch, cập nhật trong app)
python3 test/dev_server.py               # thử trên máy tính: app ở http://127.0.0.1:8765, playlist giả ở :8766
python3 test/ui_smoke.py ./shots         # test giao diện bằng Chrome headless + ảnh chụp (cần playwright, Chrome, ffmpeg)
python3 tools/build_ipk.py               # tạo dist/com.mytivi.webos_<phiên bản>_all.ipk
```

Thử nhanh trên máy tính: chạy `test/dev_server.py`, mở `http://127.0.0.1:8765/index.html` bằng Chrome, dán `http://127.0.0.1:8766/playlist.m3u` vào Cài đặt (Esc = Back, PageUp/PageDown = CH+/CH-, F = Vàng, I = Info). Đổi kích thước cửa sổ để xem bố cục co giãn. Chrome máy tính không phát HLS gốc nên chỉ thử được luồng mp4/webm (đặt một file `test/ok.mp4` để có hình xem trước).

Code cố ý viết theo ES5/ES2015 (không `async/await`, `=>`, `?.`, `flex gap`, CSS grid...) để chạy được trên Chromium 53 của webOS 4.

| Bản Android | Bản webOS |
|---|---|
| `M3uParser.kt`, `EpgParser.kt`, `GuideModel.kt` | `js/m3u.js`, `js/epg.js`, `js/guide.js` |
| `Http.kt`, `Prefs.kt` | `js/net.js`, `js/store.js` |
| `MainViewModel.kt` | `js/data.js` |
| `PlayerFactory.kt`, `StreamInfo.kt` | `js/player.js` |
| `BrowseScreen.kt` (+ `Components.kt`) | `js/browse.js`, `js/vlist.js`, `css/app.css` |
| `PlayerScreen.kt` | `js/watch.js` |
| `SetupScreen.kt`, `MainActivity.kt` | `js/setup.js`, `js/app.js` |
| `Updater.kt`, `UpdateViewModel.kt`, `UpdateDialog.kt` | `js/update.js` (+ `js/boot.js` nạp bản đã tải) |
| `.github/workflows/build-apk.yml` | `.github/workflows/build-ipk.yml` |

Chỉnh tần suất tự cập nhật ở đầu `js/data.js` (`PLAYLIST_TTL_MS`, `EPG_TTL_MS`, `CHECK_EVERY_MS`); kích thước bảng lịch ở đầu `js/browse.js` và `css/app.css` (cột kênh 495px, hàng 87px, 9.6px/phút, 12 giờ); quy tắc co giãn ở `fit()` trong `js/app.js`.

## Giấy phép bên thứ ba

`js/lib/pako.es5.min.js`: [pako](https://github.com/nodeca/pako) 2.1.0 (MIT và Zlib), dùng để giải nén EPG `.gz`. Xem `js/lib/pako.LICENSE.txt`.
