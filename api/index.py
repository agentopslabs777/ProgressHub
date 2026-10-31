from http.server import BaseHTTPRequestHandler
import json
import traceback
import sys
import os

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        diag = {}
        try:
            root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if root_dir not in sys.path:
                sys.path.insert(0, root_dir)
            diag["root_dir"] = root_dir
            diag["files_in_root"] = os.listdir(root_dir) if os.path.exists(root_dir) else []
            diag["python_version"] = sys.version
            
            import backend
            diag["backend_module"] = str(backend)
            
            from backend.app.main import app
            diag["fastapi_app"] = str(app)
            diag["status"] = "SUCCESS"
        except Exception as e:
            diag["status"] = "IMPORT_ERROR"
            diag["error"] = str(e)
            diag["traceback"] = traceback.format_exc().split("\n")
            
        self.wfile.write(json.dumps(diag, indent=2).encode('utf-8'))

    def do_POST(self):
        # Forward or echo
        self.do_GET()
