import os
import sys
import traceback

# Ensure root directory is in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from backend.app.main import app as main_app
    app = main_app
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
