#!/bin/sh
echo "--- tables ---"
docker exec gavle-db psql -U gavle -d gavle -tAc \
  "select tablename from pg_tables where schemaname='public' order by 1"
echo "--- row counts ---"
docker exec gavle-db psql -U gavle -d gavle -tAc \
  "select 'users=' || (select count(*) from users) || ' sessions=' || (select count(*) from sessions)"
echo "--- password hashes are scrypt, not plaintext ---"
docker exec gavle-db psql -U gavle -d gavle -tAc \
  "select coalesce(min(left(password_hash, 12)), 'none') from users"
