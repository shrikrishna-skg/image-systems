"""Startup script that avoids Path.cwd() permission issues on macOS."""
import os
import sys

# Set the working directory explicitly before uvicorn tries Path.cwd()
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[backend_dir],
    )
