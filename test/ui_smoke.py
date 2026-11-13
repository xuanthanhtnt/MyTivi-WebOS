#!/usr/bin/env python3
"""Kiểm thử giao diện bằng Chrome headless (mô phỏng remote bằng phím) + chụp ảnh 1920x1080.

Cần: python3, playwright (pip), Google Chrome, ffmpeg.
Chạy:  python3 test/ui_smoke.py [thư_mục_ảnh]
"""
import gzip, os, subprocess, sys, tempfile, threading, time, datetime
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler, BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else tempfile.mkdtemp(prefix='mytivi_shots_')
os.makedirs(OUT, exist_ok=True)
APP_PORT, FIX_PORT = 8765, 8766
APP = f'http://127.0.0.1:{APP_PORT}/index.html'
FIX = f'http://127.0.0.1:{FIX_PORT}'
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')

# ---------------- dữ liệu giả ----------------
GROUPS = ['Quốc gia', 'Thể thao', 'Phim', 'Tin tức', 'Thiếu nhi', 'Quốc tế', 'Âm nhạc', 'Khác']
N = 300


def make_playlist():
    lines = ['#EXTM3U url-tvg="%s/epg.xml.gz"' % FIX]
    for n in range(1, N + 1):
        cid = f'ch{n}' if n % 5 else ''
        name = 'Test <b>XSS</b> & "q"' if n == 3 else f'Kênh {n} HD'
        logo = f'{FIX}/logo.png' if n % 3 == 0 else ''
        url = f'{FIX}/missing.mp4' if n == 7 else f'{FIX}/ok.mp4?c={n}'
        lines.append(f'#EXTINF:-1 tvg-id="{cid}" tvg-logo="{logo}" group-title="{GROUPS[n % len(GROUPS)]}",{name}')
        lines.append(url)
    return '\n'.join(lines).encode('utf-8')


def make_epg():
    now = datetime.datetime.now(datetime.timezone.utc)
    start0 = now - datetime.timedelta(hours=3)
    f = lambda d: d.strftime('%Y%m%d%H%M%S +0000')
    x = ['<?xml version="1.0" encoding="UTF-8"?><tv>']
    for n in range(1, N + 1):
        if n % 5 == 0:
            continue
        t = start0 + datetime.timedelta(minutes=(n * 7) % 40)
        k = 0
        while t < now + datetime.timedelta(hours=26):
            dur = 30 + ((n + k) * 13) % 70
            e = t + datetime.timedelta(minutes=dur)
            x.append(f'<programme start="{f(t)}" stop="{f(e)}" channel="CH{n}"><title>Chương trình {n}-{k} &amp; tin</title></programme>')
            t = e
            k += 1
    x.append('</tv>')
    return gzip.compress('\n'.join(x).encode('utf-8'))


def make_logo():
    from PIL import Image
    import io
    b = io.BytesIO()
    Image.new('RGB', (64, 64), '#F59E0B').save(b, 'PNG')
    return b.getvalue()


def ensure_video(path):
    if os.path.exists(path):
        return
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25',
                    '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '300', '-c:v', 'libx264', '-b:v', '300k',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', path], check=True)


class Fixtures(BaseHTTPRequestHandler):
    playlist = epg = logo = b''
    video = ''

    def log_message(self, *a): pass

    def do_GET(self):
        p = self.path.split('?')[0]
        routes = {'/playlist.m3u': (self.playlist, 'audio/x-mpegurl'), '/epg.xml.gz': (self.epg, 'application/gzip'),
                  '/logo.png': (self.logo, 'image/png')}
        if p == '/ok.mp4':
            data, ct = open(self.video, 'rb').read(), 'video/mp4'
        elif p in routes:
            data, ct = routes[p]
        else:
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return
        self.send_response(200)
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        try:
            self.wfile.write(data)
        except Exception:
            pass


def serve(handler, port):
    s = ThreadingHTTPServer(('127.0.0.1', port), handler)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


# ---------------- khung kiểm thử ----------------
fails, passes = [], 0


def check(name, cond, extra=''):
    global passes
    if cond:
        passes += 1
        print('  ok   ', name)
    else:
        fails.append(name)
        print('  FAIL ', name, extra)


def main():
    video = os.path.join(OUT, 'ok.mp4')
    ensure_video(video)
    Fixtures.playlist, Fixtures.epg, Fixtures.logo, Fixtures.video = make_playlist(), make_epg(), make_logo(), video

    class App(SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    serve(partial(App, directory=ROOT), APP_PORT)
    serve(Fixtures, FIX_PORT)

    errors = []
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path=CHROME, headless=True,
                                args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu'])
        ctx = br.new_context(viewport={'width': 1920, 'height': 1080})
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append('pageerror: %s' % e))
        page.on('console', lambda m: errors.append('console.error: %s' % m.text)
                if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        ev = page.evaluate
        press = lambda k, n=1: [page.keyboard.press(k) or time.sleep(0.12) for _ in range(n)]
        shot = lambda name: page.screenshot(path=os.path.join(OUT, name + '.png'))
        S = lambda: ev('MT.browse._state')

        print('== 1. Cài đặt lần đầu')
        page.goto(APP)
        page.wait_for_function('window.MT && MT.app && MT.app.current()')
        check('mở app lần đầu vào màn Cài đặt', ev('MT.app.current()') == 'setup')
        check('video ẩn ở màn Cài đặt', ev("document.getElementById('vid').className") == 'off')
        shot('01_setup')
        press('Enter'); page.keyboard.type(FIX + '/playlist.m3u'); press('Enter')
        press('ArrowDown'); press('Enter'); page.keyboard.type(FIX + '/epg.xml.gz'); press('Enter')
        press('ArrowDown', 2)
        press('Enter')                                             # Lưu
        page.wait_for_function('MT.data.channels.length > 0', timeout=15000)
        check('sau khi lưu vào màn hình chính', ev('MT.app.current()') == 'browse')
        check('đọc đủ %d kênh qua máy chủ khác origin' % N, ev('MT.data.channels.length') == N, ev('MT.data.channels.length'))
        check('đã lưu link playlist', ev("MT.prefs.playlistUrl") == FIX + '/playlist.m3u')

        print('== 2. Màn hình chính')
        page.wait_for_function('Object.keys(MT.data.epg).length > 0', timeout=15000)
        page.wait_for_function("MT.player.state === 'playing'", timeout=20000)
        time.sleep(1.5)
        rows = ev("document.querySelectorAll('.grow').length")
        check('danh sách ảo hóa: chỉ dựng %d hàng/%d kênh' % (rows, N), 0 < rows <= 16)
        check('có ô chương trình đang phát (live)', ev("document.querySelectorAll('.cell.live').length") > 0)
        check('thanh giờ có 24 mốc nửa giờ', ev("document.querySelectorAll('.tlh').length") == 24)
        check('tên kênh chứa HTML được escape, không chèn thẻ', ev("document.querySelectorAll('.grow b').length") == 0
              and '<b>XSS</b>' in ev("document.querySelector('.grow:nth-child(3) .name').textContent"))
        check('xem trước có tiếng/hình đang chạy (video playing)', ev("MT.player.state") == 'playing'
              and ev("document.getElementById('vid').currentTime") > 0.3)
        check('video nằm trong khung xem trước', ev("document.getElementById('vid').className") == 'pv')
        title = ev("document.getElementById('iTitle').textContent")
        check('khung thông tin hiện tên chương trình', title.startswith('Chương trình') and '& tin' in title, title)
        shot('02_browse')

        print('== 3. Điều hướng bằng remote')
        press('ArrowRight')
        check('Phải: tên kênh -> ngôi sao', S()['col'] == -1)
        press('ArrowRight')
        check('Phải: ngôi sao -> ô chương trình', S()['col'] >= 0)
        press('ArrowDown')
        check('Xuống giữ nguyên cột ô chương trình', S()['row'] == 1 and S()['col'] >= 0)
        press('ArrowRight', 3)
        shot('03_cell_scrolled')
        check('trượt ngang theo ô đang chọn', S()['sx'] >= 0)
        for _ in range(12):                                       # Trái đến khi về cột tên kênh (đừng bấm thừa: sẽ mở ngăn nhóm)
            if S()['col'] == -2:
                break
            press('ArrowLeft')
        check('Trái về tận cột tên kênh', S()['col'] == -2 and S()['drawer'] is False)
        press('ArrowUp')
        check('Lên về hàng đầu', S()['row'] == 0)
        press('ArrowUp')
        check('cuộn vòng: hàng đầu bấm Lên -> kênh cuối', S()['row'] == N - 1, S()['row'])
        press('ArrowDown')
        check('cuộn vòng: kênh cuối bấm Xuống -> kênh đầu', S()['row'] == 0)
        rows_after = ev("document.querySelectorAll('.grow').length")
        check('sau khi nhảy vòng vẫn chỉ dựng ít hàng', rows_after <= 16, rows_after)
        press('PageDown')
        check('CH- (PageDown) nhảy một trang', S()['row'] > 3)
        press('ArrowUp', S()['row'])
        check('về hàng đầu', S()['row'] == 0)

        print('== 4. Yêu thích')
        press('f')
        check('Vàng: thêm yêu thích', ev('MT.data.isFavorite(MT.data.channels[0])') is True)
        check('ngôi sao đổi sang đầy', ev("document.querySelector('.grow .st .ic').classList.contains('on')"))
        press('f')
        check('Vàng lần 2: bỏ yêu thích', ev('MT.data.isFavorite(MT.data.channels[0])') is False)

        print('== 5. Ngăn nhóm kênh')
        press('ArrowLeft')
        check('Trái ở cột tên kênh mở ngăn nhóm', S()['drawer'] is True)
        time.sleep(0.5)
        shot('04_drawer')
        press('ArrowDown')
        grp_count = ev('MT.browse._state.counts[2]')
        check('đi tới nhóm nào, danh sách đổi theo nhóm đó', len(S()['shown']) == grp_count and grp_count < N, (len(S()['shown']), grp_count))
        press('Enter')
        check('Enter trong ngăn: đóng ngăn, giữ nhóm đã chọn', S()['drawer'] is False and len(S()['shown']) == grp_count)
        press('ArrowLeft'); press('ArrowUp'); press('Enter')      # nhóm 1 -> "Tất cả"
        check('chọn lại "Tất cả"', len(S()['shown']) == N)

        print('== 6. Xem toàn màn hình')
        press('Enter')
        check('OK vào màn hình xem kênh', ev('MT.app.current()') == 'watch')
        check('video phủ toàn màn hình', ev("document.getElementById('vid').className") == 'full')
        page.wait_for_function("MT.player.state === 'playing'", timeout=20000)
        time.sleep(1.2)
        check('thanh thông tin hiện', ev("document.getElementById('infoBar').classList.contains('show')"))
        badges = ev("Array.from(document.querySelectorAll('#ibBadges .b')).map(b => b.textContent)")
        check('hiện nhãn chất lượng/độ phân giải', 'SD' in badges and '640×360' in badges, badges)
        shot('05_watch')
        idx0 = ev('MT.watch._state.index')
        press('ArrowUp')
        check('Lên = kênh kế tiếp', ev('MT.watch._state.index') == idx0 + 1)
        press('ArrowDown', 2)
        check('Xuống = kênh trước (cuộn vòng)', ev('MT.watch._state.index') == (idx0 - 1) % N)
        page.wait_for_function("MT.player.state === 'playing'", timeout=20000)
        press('Enter')
        check('OK mở danh sách kênh', not ev("document.getElementById('chPanel').classList.contains('hide')"))
        time.sleep(0.4)
        shot('06_channel_panel')
        press('ArrowDown', 3)
        check('di chuyển trong danh sách kênh', ev('MT.watch._state.pf') == (ev('MT.watch._state.index') + 3) % N)
        press('Escape')
        check('Back đóng danh sách', ev("document.getElementById('chPanel').classList.contains('hide')"))
        last = ev('MT.prefs.lastChannelUrl')
        press('Escape')
        check('Back lần 2 về màn hình chính', ev('MT.app.current()') == 'browse')
        check('nhớ kênh xem gần nhất', last != '' and ev("MT.browse._state.focusedUrl") == last)

        print('== 7. Kênh lỗi tự báo và thử lại')
        ev('MT.app.openWatch(MT.data.channels, 6)')
        page.wait_for_function("!document.getElementById('wErr').classList.contains('hide')", timeout=15000)
        msg = ev("document.getElementById('wErr').textContent")
        check('báo lỗi khi không phát được kênh', msg.startswith('Không phát được kênh này'), msg)
        shot('07_error')
        ev('MT.app.openWatch(MT.data.channels, 10)')              # sang kênh tốt để "kênh xem gần nhất" là kênh phát được
        page.wait_for_function("MT.player.state === 'playing' && !MT.player.url.includes('missing')", timeout=20000)
        check('đổi sang kênh tốt thì hết báo lỗi', ev("document.getElementById('wErr').classList.contains('hide')"))
        ev("MT.app.go('browse')")

        print('== 8. Mở lại app: vào thẳng kênh gần nhất từ cache')
        page.reload()
        page.wait_for_function("MT.app && MT.app.current() === 'watch'", timeout=15000)
        check('mở lại vào thẳng màn xem kênh', True)
        cached = ev('MT.data.channels.length')
        check('kênh nạp từ cache', cached == N, cached)

        print('== 9. Chuẩn bị chụp ảnh khung xem trước sau khi quay về')
        press('Escape')
        try:
            page.wait_for_function("MT.player.state === 'playing'", timeout=12000)
        except Exception:
            print('  chẩn đoán:', ev("({scr: MT.app.current(), st: MT.player.state, err: MT.player.errorCode, url: MT.player.url, "
                                      "pv: MT.browse._state.previewUrl, foc: MT.browse._state.focusedUrl, "
                                      "hidden: document.hidden, vid: document.getElementById('vid').className, "
                                      "t: document.getElementById('vid').currentTime, rs: document.getElementById('vid').readyState, "
                                      "src: document.getElementById('vid').currentSrc})"))
            print('  lỗi trang:', errors[:5])
        time.sleep(1)
        shot('08_browse_after')
        check('quay về giữ nguyên luồng đang chạy trong khung xem trước', ev("document.getElementById('vid').className") == 'pv'
              and ev("MT.player.state") == 'playing')

        print('== 10. Co giãn theo màn hình TV LG (FHD 1280x720, 1366x768, StanbyME dọc, 21:9, 4:3)')
        rect = "(id => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); })"
        for w, h, want in [(1280, 720, [1920, 1080]), (1366, 768, [1921, 1080]), (1080, 1920, [1280, 2276]),
                           (2560, 1080, [2560, 1080]), (1024, 768, [1440, 1080]), (1920, 1080, [1920, 1080])]:
            page.set_viewport_size({'width': w, 'height': h})
            time.sleep(0.4)
            L = ev('[MT.layout.W, MT.layout.H]')
            check('%dx%d: bố cục %dx%d px thiết kế' % (w, h, want[0], want[1]), L == want, L)
            check('%dx%d: video trùng khung xem trước' % (w, h), ev(rect + "('vid')") == ev(rect + "('pv')"))
            check('%dx%d: không tràn khỏi màn hình' % (w, h),
                  ev('[document.documentElement.scrollWidth, document.documentElement.scrollHeight]') == [w, h])
            g = ev(rect + "('guide')")
            check('%dx%d: bảng lịch lấp tới đáy màn hình' % (w, h), abs(g[1] + g[3] - h * (1 - 24 / L[1])) <= 2, g)
            shot('10_layout_%dx%d' % (w, h))

        br.close()

    real = [e for e in errors if 'MEDIA_ELEMENT_ERROR' not in e and 'net::ERR' not in e]
    check('không có lỗi JavaScript chưa bắt', not real, real[:5])
    print('\nẢnh chụp: %s' % OUT)
    print('Kết quả: %d đạt, %d lỗi' % (passes, len(fails)))
    for f in fails:
        print('  - ' + f)
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
