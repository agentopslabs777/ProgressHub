import os
import sys

# Ensure root directory is in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class VercelPathCorrection(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        raw_path = request.scope.get("path", "")
        matched_path = request.headers.get("x-matched-path", "")
        if raw_path in ("/api/index.py", "/api/index", "/api", "") and matched_path:
            request.scope["path"] = matched_path
        elif raw_path.startswith("/api/index.py"):
            request.scope["path"] = raw_path[len("/api/index.py"):] or "/"
        return await call_next(request)

app.add_middleware(VercelPathCorrection)
