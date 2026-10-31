#!/bin/bash
# Nightly Postgres dump. Keeps two weeks, restores cleanly into a scratch
# database (see docs/RUNBOOK.md for the restore check).
set -euo pipefail

DIR=/var/backups/gavle
KEEP=14
mkdir -p "$DIR"

STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$DIR/gavle-$STAMP.sql.gz"

# pg_dump runs inside the container: the unix socket is trusted there, so no
# password is passed on a command line where `ps` would show it.
docker exec gavle-db sh -c 'pg_dump -U gavle -d gavle --clean --if-exists' | gzip > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"

# Fail loudly if the archive is corrupt rather than discovering it at restore time.
gunzip -t "$OUT"

ls -1t "$DIR"/gavle-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "backup ok: $OUT ($(du -h "$OUT" | cut -f1)), keeping $KEEP"
