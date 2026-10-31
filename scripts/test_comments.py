#!/usr/bin/env python3
"""Comment endpoint test, including moderation and cascade-on-delete."""
from __future__ import annotations

import json
import secrets
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://willthegavlegoatburn.com"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)
cookie = ""
results = []


def req(method: str, path: str, payload: dict | None = None):
    global cookie
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"User-Agent": UA, "Accept": "application/json"}
    if data:
        headers["Content-Type"] = "application/json"
        headers["Origin"] = BASE
    if cookie:
        headers["Cookie"] = cookie
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=25) as resp:
            sc = resp.headers.get("Set-Cookie")
            if sc:
                cookie = sc.split(";")[0]
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def check(label, ok, detail=""):
    results.append((label, ok))
    print(f"{'PASS' if ok else 'FAIL'}  {label}{('  ' + str(detail)) if detail else ''}")


def main() -> int:
    global cookie
    marker = f"goatcheck-{secrets.token_hex(3)}"
    email = f"cmt.{secrets.token_hex(4)}@example.com"

    s, b = req("GET", "/api/comments")
    check("public read works", s == 200 and b.get("ok") is True, s)

    cookie = ""
    s, b = req("POST", "/api/comments", {"body": "hello there"})
    check("anonymous post blocked", s == 401 and b.get("error") == "sign_in_required", s)

    s, b = req("POST", "/api/auth/register", {"email": email, "password": "comment-test-pass-1"})
    check("registered", s == 200, s)

    s, b = req("POST", "/api/comments", {"body": f"I think it burns before new year. {marker}"})
    check("valid comment posted", s == 201 and b.get("ok") is True, s)

    s, b = req("POST", "/api/comments", {"body": "this is sh1t and full of fuuuck"})
    check("profanity blocked", s == 400 and b.get("error") == "language", s)

    s, b = req("POST", "/api/comments", {"body": "buy at https://spam.example.com now"})
    check("links blocked", s == 400 and b.get("error") == "no_links", s)

    s, b = req("POST", "/api/comments", {"body": "x" * 600})
    check("too long blocked", s == 400 and b.get("error") == "too_long", s)

    s, b = req("POST", "/api/comments", {"body": "SHOUTING AT EVERYONE RIGHT NOW OK"})
    check("shouting blocked", s == 400 and b.get("error") == "shouting", s)

    s, b = req("GET", "/api/comments")
    bodies = " ".join(c["body"] for c in b.get("comments", []))
    check("comment visible publicly", marker in bodies, s)

    s, b = req("POST", "/api/comments", {"body": "second post"})
    check("second post ok", s == 201, s)
    s, b = req("POST", "/api/comments", {"body": "third post"})
    check("third post ok", s == 201, s)

    s, b = req("POST", "/api/comments", {"body": "fourth post should be capped"})
    check("post cap after 3 accepted", s == 429 and b.get("error") == "rate_limited", s)

    s, b = req(
        "POST", "/api/auth/account",
        {"action": "delete", "currentPassword": "comment-test-pass-1", "confirm": "DELETE"},
    )
    check("account deleted", s == 200, s)

    s, b = req("GET", "/api/comments")
    bodies = " ".join(c["body"] for c in b.get("comments", []))
    check("comments cascade-deleted with account", marker not in bodies, s)

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
