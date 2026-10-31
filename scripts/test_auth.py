#!/usr/bin/env python3
"""
Full account lifecycle test against a running deployment.

    python scripts/test_auth.py

Covers register -> session -> duplicate -> login failures -> password change ->
session invalidation -> account deletion. Prints one line per step.
"""
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
results: list[tuple[str, bool, str]] = []


def request(method: str, path: str, payload: dict | None = None, use_cookie: bool = True):
    global cookie
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"User-Agent": UA, "Accept": "application/json"}
    if data:
        headers["Content-Type"] = "application/json"
        headers["Origin"] = BASE
    if use_cookie and cookie:
        headers["Cookie"] = cookie

    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read()
            set_cookie = r.headers.get("Set-Cookie")
            if set_cookie:
                cookie = set_cookie.split(";")[0]
            return r.status, json.loads(body or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def check(label: str, condition: bool, detail: str = "") -> None:
    results.append((label, condition, detail))
    print(f"{'PASS' if condition else 'FAIL'}  {label}{('  ' + detail) if detail else ''}")


def main() -> int:
    email = f"test.{secrets.token_hex(4)}@example.com"
    password = "correct-horse-battery"
    new_password = "another-long-password-42"

    s, b = request("POST", "/api/auth/register", {"email": email, "password": password})
    check("register", s == 200 and b.get("ok") is True, f"{s}")

    s, b = request("GET", "/api/auth/me")
    check("session works", s == 200 and b.get("user", {}).get("email") == email, f"{s}")

    s, b = request("POST", "/api/auth/register", {"email": email, "password": password})
    check("duplicate rejected", s == 409 and b.get("error") == "email_taken", f"{s}")

    s, b = request("POST", "/api/auth/register", {"email": email, "password": "short"})
    check("weak password rejected", s == 400 and b.get("error") == "password_too_short", f"{s}")

    global cookie
    saved = cookie
    cookie = ""
    s, b = request("POST", "/api/auth/login", {"email": email, "password": "wrong-password-1"})
    check("wrong password rejected", s == 401 and b.get("error") == "invalid_credentials", f"{s}")

    s, b = request("POST", "/api/auth/login", {"email": email, "password": password})
    check("login", s == 200 and b.get("ok") is True, f"{s}")
    cookie = cookie or saved

    s, b = request("POST", "/api/auth/account", {"action": "password", "currentPassword": "nope"})
    check("bad current password blocked", s == 401 and b.get("error") == "wrong_password", f"{s}")

    s, b = request(
        "POST",
        "/api/auth/account",
        {"action": "password", "currentPassword": password, "newPassword": new_password},
    )
    check("password changed", s == 200 and b.get("ok") is True, f"{s}")

    cookie = ""
    s, b = request("POST", "/api/auth/login", {"email": email, "password": password})
    check("old password no longer works", s == 401, f"{s}")

    s, b = request("POST", "/api/auth/login", {"email": email, "password": new_password})
    check("new password works", s == 200, f"{s}")

    s, b = request(
        "POST",
        "/api/auth/account",
        {"action": "delete", "currentPassword": new_password, "confirm": "delete"},
    )
    check("delete needs exact confirm", s == 400 and b.get("error") == "confirm_required", f"{s}")

    s, b = request(
        "POST",
        "/api/auth/account",
        {"action": "delete", "currentPassword": new_password, "confirm": "DELETE"},
    )
    check("account deleted", s == 200 and b.get("ok") is True, f"{s}")

    cookie = ""
    s, b = request("POST", "/api/auth/login", {"email": email, "password": new_password})
    check("deleted account cannot log in", s == 401, f"{s}")

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
