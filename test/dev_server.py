#!/usr/bin/env python3
"""Thử app trên máy tính: phục vụ thư mục app (cổng 8765) + playlist/EPG giả có CORS (cổng 8766).

Chạy:  python3 test/dev_server.py      rồi mở http://127.0.0.1:8765/index.html
Trong Cài đặt dán:  http://127.0.0.1:8766/playlist.m3u   (EPG tự lấy từ url-tvg của playlist)
Muốn có hình xem trước: đặt một file test/ok.mp4 (Chrome máy tính không phát được HLS).
"""
import datetime, gzip, os, struct, threading, zlib
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler, BaseHTTPRequestHandler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
APP_PORT, FIX_PORT = 8765, 8766
FIX = 'http://127.0.0.1:%d' % FIX_PORT
GROUPS = ['Quốc gia', 'Thể thao', 'Phim', 'Tin tức', 'Thiếu nhi', 'Quốc tế', 'Âm nhạc', 'Khác']
N = 300


def playlist():
    lines = ['#EXTM3U url-tvg="%s/epg.xml.gz"' % FIX]
    for n in range(1, N + 1):
        cid = 'ch%d' % n if n % 5 else ''
        logo = FIX + '/logo.png' if n % 3 == 0 else ''
        lines.append('#EXTINF:-1 tvg-id="%s" tvg-logo="%s" group-title="%s",Kênh %d HD' % (cid, logo, GROUPS[n % len(GROUPS)], n))
        lines.append('%s/ok.mp4?c=%d' % (FIX, n))
    return '\n'.join(lines).encode('utf-8')


def epg():
    now = datetime.datetime.now(datetime.timezone.utc)
    f = lambda d: d.strftime('%Y%m%d%H%M%S +0000')
    x = ['<?xml version="1.0" encoding="UTF-8"?><tv>']
    for n in range(1, N + 1):
        if n % 5 == 0:
            continue
        t, k = now - datetime.timedelta(hours=3, minutes=(n * 7) % 40), 0
        while t < now + datetime.timedelta(hours=26):
            e = t + datetime.timedelta(minutes=30 + ((n + k) * 13) % 70)
            x.append('<programme start="%s" stop="%s" channel="CH%d"><title>Chương trình %d-%d &amp; tin</title></programme>' % (f(t), f(e), n, n, k))
            t, k = e, k + 1
    x.append('</tv>')
    return gzip.compress('\n'.join(x).encode('utf-8'))


def png(w=64, h=64, rgb=(0xF5, 0x9E, 0x0B)):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + \
        chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


class Fixtures(BaseHTTPRequestHandler):
    data = {}

    def log_message(self, *a):
        pass

    def do_GET(self):
        p = self.path.split('?')[0]
        video = os.path.join(ROOT, 'test', 'ok.mp4')
        if p == '/ok.mp4' and os.path.exists(video):
            body, ct = open(video, 'rb').read(), 'video/mp4'
        elif p in self.data:
            body, ct = self.data[p]
        else:
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return
        self.send_response(200)
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)


class App(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    Fixtures.data = {'/playlist.m3u': (playlist(), 'audio/x-mpegurl'), '/epg.xml.gz': (epg(), 'application/gzip'),
                     '/logo.png': (png(), 'image/png')}
    fx = ThreadingHTTPServer(('127.0.0.1', FIX_PORT), Fixtures)
    threading.Thread(target=fx.serve_forever, daemon=True).start()
    print('App:      http://127.0.0.1:%d/index.html' % APP_PORT)
    print('Playlist: %s/playlist.m3u' % FIX, flush=True)
    ThreadingHTTPServer(('127.0.0.1', APP_PORT), partial(App, directory=ROOT)).serve_forever()


if __name__ == '__main__':
    main()
