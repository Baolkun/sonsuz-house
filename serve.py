# Önbelleksiz yerel sunucu (deneme için)
import http.server, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
import os
port = int(os.environ.get('PORT') or (sys.argv[1] if len(sys.argv) > 1 else 8790))
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
