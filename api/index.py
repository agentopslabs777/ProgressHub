from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/")
@app.get("/api")
@app.get("/healthz")
@app.get("/api/healthz")
@app.get("/api/v1/healthz")
def health():
    return {"status": "ok", "message": "FastAPI on Vercel is working!"}

@app.get("/api/v1/test-import")
def test_import():
    try:
        import sys, os
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if root_dir not in sys.path:
            sys.path.insert(0, root_dir)
        import backend.app.main
        return {"status": "success", "imported": str(backend.app.main)}
    except Exception as e:
        import traceback
        return JSONResponse(status_code=500, content={"error": str(e), "trace": traceback.format_exc().split("\n")})
