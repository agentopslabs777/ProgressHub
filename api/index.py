import os
import sys
import traceback

# Ensure root directory is in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from backend.app.main import app as main_app

    class VercelPathCorrectionMiddleware:
        def __init__(self, inner_app):
            self.inner_app = inner_app

        async def __call__(self, scope, receive, send):
            if scope.get("type") == "http":
                raw_path = scope.get("path", "")
                headers = dict(scope.get("headers", []))
                matched_path = headers.get(b"x-matched-path", b"").decode("utf-8")

                if raw_path in ("/api/index.py", "/api/index", "/api", "") and matched_path:
                    scope["path"] = matched_path
                elif raw_path.startswith("/api/index.py"):
                    scope["path"] = raw_path[len("/api/index.py"):] or "/"

            await self.inner_app(scope, receive, send)

    app = VercelPathCorrectionMiddleware(main_app)

except Exception as e:
    tb_str = traceback.format_exc()
    print("FATAL: Failed to import FastAPI application on Vercel:\n", tb_str)

    # Pure ASGI fallback handler to return exact diagnostic information
    async def app(scope, receive, send):
        if scope['type'] == 'http':
            import json
            payload = json.dumps({
                "status": "error",
                "message": "FastAPI failed to start on Vercel",
                "exception": str(e),
                "traceback": tb_str.split("\n")
            }, indent=2).encode('utf-8')

            await send({
                'type': 'http.response.start',
                'status': 500,
                'headers': [
                    [b'content-type', b'application/json'],
                    [b'content-length', str(len(payload)).encode('utf-8')]
                ]
            })
            await send({
                'type': 'http.response.body',
                'body': payload
            })
