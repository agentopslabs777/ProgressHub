from fastapi import FastAPI
from fastapi.responses import JSONResponse
import sys
import os
import traceback

app = FastAPI(title="Diagnostic Probe")

@app.get("/")
@app.get("/test")
@app.get("/api/test")
def test():
    return {
        "status": "ok",
        "python_version": sys.version,
        "platform": sys.platform,
        "cwd": os.getcwd()
    }

@app.get("/api/test/env")
def test_env():
    # Return available env var names safely without disclosing secrets
    keys = list(os.environ.keys())
    return {
        "env_keys": sorted(keys),
        "has_database_url": "DATABASE_URL" in os.environ
    }

@app.get("/api/test/files")
def test_files():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return {
        "root": root,
        "root_contents": os.listdir(root) if os.path.exists(root) else [],
        "sys_path": sys.path
    }

@app.get("/api/test/import-backend")
def test_backend():
    try:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if root not in sys.path:
            sys.path.insert(0, root)
        import backend
        return {"status": "ok", "backend_file": getattr(backend, "__file__", "unknown")}
    except BaseException as e:
        return JSONResponse(status_code=500, content={
            "error_type": type(e).__name__,
            "error": str(e),
            "traceback": traceback.format_exc().split("\n")
        })

@app.get("/api/test/import-session")
def test_session():
    try:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if root not in sys.path:
            sys.path.insert(0, root)
        from backend.app.db.session import engine
        return {"status": "ok", "engine": str(engine)}
    except BaseException as e:
        return JSONResponse(status_code=500, content={
            "error_type": type(e).__name__,
            "error": str(e),
            "traceback": traceback.format_exc().split("\n")
        })

@app.get("/api/test/import-main")
def test_main():
    try:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if root not in sys.path:
            sys.path.insert(0, root)
        from backend.app.main import app as main_app
        return {"status": "ok", "main_app_title": main_app.title}
    except BaseException as e:
        return JSONResponse(status_code=500, content={
            "error_type": type(e).__name__,
            "error": str(e),
            "traceback": traceback.format_exc().split("\n")
        })
