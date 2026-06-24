#!/usr/bin/env python3
"""静态网站生产服务器 — 双击或 python server.py 启动"""

import os
import socket
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8080"))
HOST = os.environ.get("HOST", "0.0.0.0")
ROOT = os.path.dirname(os.path.abspath(__file__))


class SiteHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "public, max-age=3600")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")


def local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def main():
    handler = partial(SiteHandler, directory=ROOT)
    server = ThreadingHTTPServer((HOST, PORT), handler)
    ip = local_ip()

    print("=" * 48)
    print("  我们俩 · 网站已启动")
    print("=" * 48)
    print(f"  本机访问:  http://127.0.0.1:{PORT}")
    print(f"  局域网访问: http://{ip}:{PORT}")
    print(f"  根目录:     {ROOT}")
    print("  按 Ctrl+C 停止")
    print("=" * 48)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.server_close()


if __name__ == "__main__":
    main()
