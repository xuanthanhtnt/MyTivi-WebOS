#!/usr/bin/env python3
"""Đóng gói MyTivi thành file .ipk cho webOS TV (không cần cài ares-cli / npm).

Định dạng làm theo `ares-package` của LG (webos-tools/cli, lib/package.js):
  ar: debian-binary ("2.0\n") + control.tar.gz + data.tar.gz
  data : usr/palm/applications/<id>/...   và   usr/palm/packages/<id>/packageinfo.json
  control: Package/Version/Section/Priority/Architecture/Installed-Size/Maintainer/Description/webOS-*

Dùng:  python3 tools/build_ipk.py [--out thư_mục] [--schema ApplicationDescription.schema]
Nếu đã có ares-cli thì dùng `ares-package .` cũng cho kết quả tương đương.
"""
import argparse, io, json, os, re, sys, tarfile, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FILES = ['appinfo.json', 'index.html', 'icon.png', 'largeIcon.png']
DIRS = ['css', 'js']          # test/, tools/, dist/, README... không đóng vào app


def fail(msg):
    print('LỖI: ' + msg, file=sys.stderr)
    sys.exit(1)


def validate(appinfo, schema_path):
    for k in ('id', 'main', 'icon', 'type', 'title'):
        if not appinfo.get(k):
            fail('appinfo.json thiếu trường bắt buộc "%s"' % k)
    if not re.match(r'^[a-z0-9.+-]+$', appinfo['id']):
        fail('id chỉ được chứa a-z 0-9 . + -')
    if not re.match(r'^([1-9]\d{0,8}|\d)\.([1-9]\d{0,8}|\d)\.([1-9]\d{0,8}|\d)$', appinfo.get('version', '1.0.0')):
        fail('version phải dạng x.y.z')
    for k in ('main', 'icon', 'largeIcon'):
        if k in appinfo and not os.path.isfile(os.path.join(ROOT, appinfo[k])):
            fail('thiếu file "%s" khai báo trong appinfo.json' % appinfo[k])
    if schema_path:
        try:
            import jsonschema
        except ImportError:
            print('(bỏ qua kiểm tra schema: chưa cài jsonschema)')
            return
        jsonschema.validate(appinfo, json.load(open(schema_path, encoding='utf-8')))
        print('appinfo.json hợp lệ theo schema ApplicationDescription của LG')


def collect():
    """[(đường dẫn tương đối trong app, đường dẫn thật)]"""
    out = []
    for f in FILES:
        out.append((f, os.path.join(ROOT, f)))
    for d in DIRS:
        for base, _, names in os.walk(os.path.join(ROOT, d)):
            for n in sorted(names):
                full = os.path.join(base, n)
                out.append((os.path.relpath(full, ROOT).replace(os.sep, '/'), full))
    for rel, _ in out:
        if not rel.isascii():
            fail('tên file phải là chữ không dấu: %s' % rel)
    return sorted(out)


def tar_gz(files, mtime):
    """files: [(tên trong tar, bytes)]; tự thêm các thư mục cha. Dùng USTAR + root để opkg đọc được."""
    dirs = set()
    for name, _ in files:
        parts = name.split('/')[:-1]
        for i in range(1, len(parts) + 1):
            dirs.add('/'.join(parts[:i]))
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz', format=tarfile.USTAR_FORMAT, compresslevel=9) as tf:
        for d in sorted(dirs):
            ti = tarfile.TarInfo(d)
            ti.type, ti.mode, ti.mtime = tarfile.DIRTYPE, 0o755, mtime
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = 'root'
            tf.addfile(ti)
        for name, data in sorted(files):
            ti = tarfile.TarInfo(name)
            ti.size, ti.mode, ti.mtime = len(data), 0o644, mtime
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = 'root'
            tf.addfile(ti, io.BytesIO(data))
    return buf.getvalue()


def ar_archive(members, mtime):
    out = bytearray(b'!<arch>\n')
    for name, data in members:
        hdr = (name.ljust(16) + str(mtime).ljust(12) + '0'.ljust(6) + '0'.ljust(6) +
               '100644'.ljust(8) + str(len(data)).ljust(10) + '`\n')
        assert len(hdr) == 60, hdr
        out += hdr.encode('ascii') + data
        if len(data) % 2:
            out += b'\n'
    return bytes(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist'))
    ap.add_argument('--schema', default=None)
    args = ap.parse_args()

    appinfo = json.load(open(os.path.join(ROOT, 'appinfo.json'), encoding='utf-8'))
    validate(appinfo, args.schema)
    app_id, version = appinfo['id'], appinfo.get('version', '1.0.0')
    mtime = int(time.time())

    data_files, size = [], 0
    for rel, full in collect():
        b = open(full, 'rb').read()
        size += len(b)
        data_files.append(('usr/palm/applications/%s/%s' % (app_id, rel), b))
    pkginfo = json.dumps({'id': app_id, 'version': version, 'app': app_id}, indent=2) + '\n'
    data_files.append(('usr/palm/packages/%s/packageinfo.json' % app_id, pkginfo.encode('utf-8')))

    control = '\n'.join([
        'Package: ' + app_id,
        'Version: ' + version,
        'Section: misc',
        'Priority: optional',
        'Architecture: all',
        'Installed-Size: %d' % size,
        'Maintainer: N/A <nobody@example.com>',
        'Description: This is a webOS application.',
        'webOS-Package-Format-Version: 2',
        'webOS-Packager-Version: x.y.x',
        ''])

    ipk = ar_archive([
        ('debian-binary', b'2.0\n'),
        ('control.tar.gz', tar_gz([('control', control.encode('utf-8'))], mtime)),
        ('data.tar.gz', tar_gz(data_files, mtime)),
    ], mtime)

    os.makedirs(args.out, exist_ok=True)
    path = os.path.join(args.out, '%s_%s_all.ipk' % (app_id, version))
    with open(path, 'wb') as f:
        f.write(ipk)
    print('Đã tạo %s (%.1f KB, %d file trong app)' % (path, len(ipk) / 1024.0, len(data_files) - 1))


if __name__ == '__main__':
    main()
