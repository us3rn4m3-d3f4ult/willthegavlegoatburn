#!/usr/bin/env python3
"""Upload a file over SFTP and verify it in the *same* SSH session."""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote import load_env, connect  # noqa: E402

local = Path(sys.argv[1])
remote = sys.argv[2]

cfg = load_env(Path(__file__).resolve().parent.parent / ".env.deploy")
client = connect(cfg, force_password=False)

data = local.read_bytes()
print(f"local  : {local}  {len(data)} bytes  sha256={hashlib.sha256(data).hexdigest()[:16]}")

sftp = client.open_sftp()
print("sftp cwd:", sftp.getcwd())
with sftp.file(remote, "wb") as fh:
    fh.write(data)
    fh.flush()
try:
    st = sftp.stat(remote)
    print(f"stat   : size={st.st_size}")
except IOError as exc:
    print(f"stat   : FAILED {exc}")
sftp.close()

for cmd in (
    f"ls -l {remote}",
    f"sha256sum {remote}",
    f"df -h {remote} | tail -1",
):
    _, out, err = client.exec_command(cmd)
    print(f"$ {cmd}\n{out.read().decode().strip()}{err.read().decode().strip()}")

client.close()
