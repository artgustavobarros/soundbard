"""Inicia um único backend local; a interface usa o mesmo endereço."""

import argparse
from pathlib import Path

import uvicorn


def main():
    parser = argparse.ArgumentParser(description="Soundbard local")
    parser.add_argument("--port", type=int, default=3000)
    parser.add_argument("--reload", action="store_true")
    options = parser.parse_args()
    print(f"Soundbard local: http://localhost:{options.port}", flush=True)
    uvicorn.run(
        "backend.app:app",
        host="127.0.0.1",
        port=options.port,
        reload=options.reload,
        reload_dirs=[str(Path(__file__).parent)] if options.reload else None,
        proxy_headers=False,
        access_log=False,
    )


if __name__ == "__main__":
    main()
