import os
import sys
import traceback

# Ensure project root is in python module search path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from backend.app.main import app
except Exception as e:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="Diagnostic Fallback")
    err_type = type(e).__name__
    err_msg = str(e)
    tb = traceback.format_exc().split("\n")

    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    async def catch_all_errors(full_path: str = ""):
        return JSONResponse(
            status_code=500,
            content={
                "status": "FATAL_IMPORT_ERROR",
                "error_type": err_type,
                "error_message": err_msg,
                "traceback": tb,
                "root_dir": root_dir,
                "sys_path": sys.path,
                "dir_contents": os.listdir(root_dir) if os.path.exists(root_dir) else []
            }
        )
