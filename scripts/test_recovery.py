#!/usr/bin/env python3
"""
Recovery-code flow test against a running deployment.

    python scripts/test_recovery.py
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


def request(method: str, path: str, payload: dict | None = None):
    global cookie
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"User-Agent": UA, "Accept": "application/json"}
    if data:
        headers["Content-Type"] = "application/json"
        headers["Origin"] = BASE
    if cookie:
        headers["Cookie"] = cookie

    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            sc = r.headers.get("Set-Cookie")
            if sc:
                cookie = sc.split(";")[0]
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def check(label: str, ok: bool, detail: str = "") -> None:
    results.append((label, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {label}{('  ' + detail) if detail else ''}")


def main() -> int:
    global cookie
    email = f"rec.{secrets.token_hex(4)}@example.com"
    pw1, pw2, pw3 = "first-password-111", "second-password-222", "third-password-333"

    uname = "u" + secrets.token_hex(4)
    s, b = request("POST", "/api/auth/register", {"username": uname, "email": email, "password": pw1})
    codes = b.get("recoveryCodes") or []
    check("register returns 10 codes", s == 200 and len(codes) == 10, f"{s} n={len(codes)}")
    if len(codes) != 10:
        return 1

    s, b = request("GET", "/api/auth/me")
    check("session active", s == 200 and b.get("user", {}).get("email") == email, f"{s}")
    check("10 codes unused", b.get("recoveryRemaining") == 10, str(b.get("recoveryRemaining")))

    # ── use a code to reset the password ─────────────────────────────────────
    cookie = ""
    s, b = request("POST", "/api/auth/recover", {"email": email, "code": codes[0], "newPassword": pw2})
    check("recover with code", s == 200 and b.get("ok") is True, f"{s}")

    s, b = request("POST", "/api/auth/login", {"email": email, "password": pw2})
    check("login with new password", s == 200, f"{s}")

    cookie = ""
    s, b = request("POST", "/api/auth/login", {"email": email, "password": pw1})
    check("old password rejected", s == 401, f"{s}")

    # ── single use ───────────────────────────────────────────────────────────
    s, b = request("POST", "/api/auth/recover", {"email": email, "code": codes[0], "newPassword": pw3})
    check("used code cannot be reused", s == 400 and b.get("error") == "invalid_code", f"{s}")

    s, b = request("POST", "/api/auth/recover", {"email": email, "code": "AAAA-BBBB-CCCC-DDDD", "newPassword": pw3})
    check("random code rejected", s == 400 and b.get("error") == "invalid_code", f"{s}")

    # ── regenerate ───────────────────────────────────────────────────────────
    cookie = ""
    s, b = request("POST", "/api/auth/login", {"email": email, "password": pw2})
    check("signed in again", s == 200, f"{s}")

    s, b = request("GET", "/api/auth/me")
    check("9 codes left", b.get("recoveryRemaining") == 9, str(b.get("recoveryRemaining")))

    s, b = request(
        "POST", "/api/auth/account", {"action": "recovery", "currentPassword": pw2}
    )
    fresh = b.get("recoveryCodes") or []
    check("regenerate gives 10 new codes", s == 200 and len(fresh) == 10, f"{s} n={len(fresh)}")

    s, b = request("GET", "/api/auth/me")
    check("counter back to 10", b.get("recoveryRemaining") == 10, str(b.get("recoveryRemaining")))

    cookie = ""
    s, b = request("POST", "/api/auth/recover", {"email": email, "code": codes[1], "newPassword": pw3})
    check("pre-regeneration code dead", s == 400 and b.get("error") == "invalid_code", f"{s}")

    s, b = request("POST", "/api/auth/recover", {"email": email, "code": fresh[0], "newPassword": pw3})
    check("new code works", s == 200, f"{s}")

    # ── cleanup ──────────────────────────────────────────────────────────────
    cookie = ""
    request("POST", "/api/auth/login", {"email": email, "password": pw3})
    s, b = request(
        "POST", "/api/auth/account",
        {"action": "delete", "currentPassword": pw3, "confirm": "DELETE"},
    )
    check("test account deleted", s == 200, f"{s}")

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
