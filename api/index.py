import os
import sys
import traceback

# Ensure root directory is in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

import_error = None
try:
    from backend.app.main import app as main_app
    app = main_app

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

except Exception as e:
    import_error = traceback.format_exc()
    print("FATAL: Failed to import FastAPI application on Vercel:\n", import_error)
    app = FastAPI()

    @app.api_route("/", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    async def catch_all(request: Request, path: str = ""):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Failed to load backend application on Vercel",
                "exception": str(e),
                "details": import_error.split("\n")
            }
        )
