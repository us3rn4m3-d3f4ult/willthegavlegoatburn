# What to watch

Everything here is queryable from a phone with one `ssh` command. No third-party
analytics, no cookies, nothing that identifies a person.

## Is it up?

```bash
curl -s https://willthegavlegoatburn.com/api/health
# {"ok":true,"db":true,"rpc":true,"at":"..."}   200 when both are healthy, 503 otherwise
```

Point an external monitor (UptimeRobot, BetterStack, a cron with `curl -f`) at
that URL. The container healthcheck only proves Next is listening; this proves the
database and the RPC answer too.

## How many people came

`page_views` is a date, a path and a counter. Nothing else.

```bash
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle -c \
  'select day, path, hits from page_views order by day desc, hits desc limit 40'"
```

Today, per page:

```bash
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle -c \
  \"select path, sum(hits) from page_views where day = current_date group by 1 order by 2 desc\""
```

A view is counted once per client-side navigation, so a reload counts again while
a tab left open does not. Treat it as a trend, not a census.

## What is breaking

```bash
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle -c \
  'select created_at, path, kind, message from client_errors order by created_at desc limit 20'"
```

The same rows are in `docker logs gavle-web` as `client-error {...}` with the
browser's user-agent attached (the log line has the UA; the database deliberately
does not). The table keeps roughly the last 2000 rows.

## What got hidden

Comments are hidden, never deleted, and only after two independent reports:

```bash
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle -c \
  'select id, left(body, 80), created_at from comments where hidden order by created_at desc'"
```

To put one back after reviewing it:

```bash
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle -c \
  \"update comments set hidden = false where id = '<uuid>'\""
```

The server log also gets a `comment hidden after reports {...}` line each time the
threshold is crossed.

## What to read before changing anything

- `docs/GIFS.md` — the GIPHY key lives in the *client* by their terms, and the
  free key is rate limited (~42/hour).
- `docs/ACCOUNTS.md` — sessions, recovery codes, why `/account` is gated.
- `/api/health` and `page_views` are the two cheapest ways to notice a bad deploy.
