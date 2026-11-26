#!/usr/bin/env python3
"""proxy.py - local server for the neuro-endocrine viewer + Ember panel.

Serves the static viewer from this directory and forwards
POST /api/chat to the Meta Model API (https://api.meta.ai/v1),
injecting the Model API key from the MODEL_API_KEY environment
variable so the key never reaches the browser.

Every forwarded call is appended to ember-trace.jsonl next to this
file (timestamp, request body, response usage, latency) - the
server-side half of the prompt/token trace.

Usage:
    MODEL_API_KEY=... python3 proxy.py [port]     # default 8000
    # open http://localhost:8000 and choose "Local proxy" in the
    # Ember panel.

Standard library only. No dependencies.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

API_URL = "https://api.meta.ai/v1/chat/completions"
HERE = os.path.dirname(os.path.abspath(__file__))
TRACE_FILE = os.path.join(HERE, "ember-trace.jsonl")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_error(404, "not found")
            return
        key = os.environ.get("MODEL_API_KEY", "").strip()
        if not key:
            self._send_json(500, {"error": {"message":
                "MODEL_API_KEY is not set in the proxy environment"}})
            return
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b"{}"
        started = time.time()
        status, payload = self._forward(key, body)
        latency_ms = int((time.time() - started) * 1000)
        self._append_trace(body, status, payload, latency_ms)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _forward(self, key, body):
        req = urllib.request.Request(
            API_URL, data=body, method="POST",
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + key})
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()
        except Exception as e:  # network failure, DNS, timeout
            return 502, json.dumps(
                {"error": {"message": "proxy upstream failure: %s" % e}}
            ).encode()

    def _append_trace(self, req_body, status, resp_body, latency_ms):
        try:
            req_json = json.loads(req_body.decode("utf-8", "replace"))
        except Exception:
            req_json = {"raw": req_body.decode("utf-8", "replace")[:2000]}
        try:
            resp_json = json.loads(resp_body.decode("utf-8", "replace"))
        except Exception:
            resp_json = {}
        entry = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "endpoint": API_URL,
            "http_status": status,
            "latency_ms": latency_ms,
            "request": req_json,
            "response_id": resp_json.get("id"),
            "model_returned": resp_json.get("model"),
            "usage": resp_json.get("usage"),
        }
        try:
            with open(TRACE_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
        except OSError as e:
            sys.stderr.write("trace write failed: %s\n" % e)

    def _send_json(self, status, obj):
        payload = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    if not os.environ.get("MODEL_API_KEY"):
        sys.stderr.write(
            "warning: MODEL_API_KEY is not set - /api/chat will return 500\n")
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("serving %s on http://127.0.0.1:%d (Ctrl-C to stop)" % (HERE, port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
