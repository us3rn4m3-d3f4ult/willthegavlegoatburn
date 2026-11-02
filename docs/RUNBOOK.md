# Runbook

The three things you will actually need at 2am.

## Is it up?

```bash
curl -s https://willthegavlegoatburn.com/api/health
# {"ok":true,"db":true,"rpc":true,...}   200 healthy, 503 when the DB or RPC is down
```

```bash
ssh deploy@148.135.185.56 "cd ~/gavle/infra && docker compose ps && docker compose logs --tail=50 web"
```

## Backups

Nightly Postgres dump, installed as a systemd timer, 14 days kept:

```bash
ssh deploy@148.135.185.56 "systemctl list-timers gavle-backup.timer --no-pager; ls -lh /var/backups/gavle | tail -5"
```

Dumps are `gavle-YYYYMMDD-HHMMSS.sql.gz` (pg_dump `--clean --if-exists`, verified
with `gunzip -t` at write time).

### Restore check (do this before you need it)

Restores into a scratch database, never over the live one:

```bash
LATEST=$(ssh deploy@148.135.185.56 "ls -1t /var/backups/gavle/gavle-*.sql.gz | head -1")
ssh deploy@148.135.185.56 "docker exec gavle-db createdb -U gavle gavle_restore_test"
ssh deploy@148.135.185.56 "zcat $LATEST | docker exec -i gavle-db psql -U gavle -d gavle_restore_test -q"
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle_restore_test -tAc 'select count(*) from users'"
ssh deploy@148.135.185.56 "docker exec gavle-db dropdb -U gavle gavle_restore_test"
```

If the count comes back, the dump is usable.

### Manual backup right now

```bash
ssh deploy@148.135.185.56 "sudo /usr/local/sbin/gavle-backup.sh"
```

The same script is in `scripts/backup_db.sh`; the installed copy lives at
`/usr/local/sbin/gavle-backup.sh` and is what `gavle-backup.service` runs.

## Rollback a bad deploy

```bash
ssh deploy@148.135.185.56 "cd ~/gavle && git log --oneline -5 && git checkout <sha> && cd infra && docker compose up -d --build web"
```

Static assets are content-hashed and documents are `no-store`, so a rollback is
clean for browsers; `ChunkGuard` reloads any stale tab once.
