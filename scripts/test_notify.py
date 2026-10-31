#!/usr/bin/env python3
"""End-to-end check of POST /api/notify against a running deployment."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

URL = (sys.argv[1] if len(sys.argv) > 1 else "https://willthegavlegoatburn.com") + "/api/notify"

# Cloudflare's Bot Fight Mode challenges unknown user agents, so a bare
# Python-urllib request gets an HTML challenge page instead of JSON.
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def _decode(raw: bytes):
    try:
        return json.loads(raw or b"{}")
    except json.JSONDecodeError:
        return {"_non_json": raw[:160].decode("utf-8", "replace")}


def post(payload: dict) -> tuple[int, object]:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        URL,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": UA, "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, _decode(r.read())
    except urllib.error.HTTPError as e:
        return e.code, _decode(e.read())


def count() -> object:
    req = urllib.request.Request(URL, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return _decode(r.read())


print("valid    ", post({"email": "Cline.Test+1@Example.com"}))
print("duplicate", post({"email": "cline.test+1@example.com"}))
print("invalid  ", post({"email": "nope"}))
print("honeypot ", post({"email": "bot@example.com", "company": "spam"}))
print("count    ", count())
