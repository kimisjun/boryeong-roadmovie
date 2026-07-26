#!/usr/bin/env python3
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = int(os.environ.get("FAMILY_STATE_PORT", "8770"))
STATE_DIR = Path(os.environ.get("FAMILY_STATE_DIR", str(Path.home() / ".hermes" / "family-night-state")))
ALLOWED_ORIGINS = {
    "https://kimisjun.github.io",
    "http://127.0.0.1:8765",
    "http://localhost:8765",
}
PLAYERS = {"eunjun", "haeun", "yunhee", "hyunshin"}
LOCK = threading.Lock()

DEFAULT_GAME = {
    "version": 1,
    "phase": "collecting",
    "locked": False,
    "scores": {slug: {"tmi": 0, "pointing": 0} for slug in PLAYERS},
    "scoredKeys": [],
    "awardedKeys": [],
}

def default_player(slug):
    names = {"eunjun": "은준", "haeun": "하은", "yunhee": "윤희", "hyunshin": "현신"}
    return {"version": 1, "slug": slug, "name": names[slug], "submitted": False,
            "answers": [""] * 10, "draftIndex": 0,
            "live": {"game": None, "key": None, "value": None, "submittedAt": None},
            "onlineAt": 0, "updatedAt": 0}

def route_file(path):
    clean = urlparse(path).path.rstrip("/")
    if clean == "/game": return STATE_DIR / "game.json", DEFAULT_GAME
    parts = clean.split("/")
    if len(parts) == 3 and parts[1] == "players" and parts[2] in PLAYERS:
        return STATE_DIR / f"player-{parts[2]}.json", default_player(parts[2])
    return None, None

def read_state(path, default):
    if not path.exists():
        write_state(path, default)
    return json.loads(path.read_text(encoding="utf-8"))

def write_state(path, value):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(temp, path)

class Handler(BaseHTTPRequestHandler):
    server_version = "FamilyNightState/1.0"

    def cors(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")

    def respond(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self):
        path, default = route_file(self.path)
        if path is None: return self.respond(404, {"error": "not found"})
        with LOCK:
            try: value = read_state(path, default)
            except Exception as error: return self.respond(500, {"error": str(error)})
        self.respond(200, value)

    def do_PUT(self):
        path, default = route_file(self.path)
        if path is None: return self.respond(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 1_000_000: return self.respond(413, {"error": "payload too large"})
            value = json.loads(self.rfile.read(length))
            if not isinstance(value, dict): raise ValueError("JSON object required")
            with LOCK: write_state(path, value)
        except Exception as error:
            return self.respond(400, {"error": str(error)})
        self.respond(200, value)

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}", flush=True)

if __name__ == "__main__":
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    for slug in PLAYERS:
        read_state(STATE_DIR / f"player-{slug}.json", default_player(slug))
    read_state(STATE_DIR / "game.json", DEFAULT_GAME)
    print(f"Family state API listening on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
