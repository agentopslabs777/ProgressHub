import os
import sys

# Ensure project root is in python module search path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from fastapi import FastAPI
import backend.app.main

app: FastAPI = backend.app.main.app
