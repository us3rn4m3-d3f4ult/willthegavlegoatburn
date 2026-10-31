#!/bin/sh
echo "--- web DATABASE_URL (masked) ---"
docker exec gavle-web sh -c 'printenv DATABASE_URL | sed "s/:.*@/:****@/"'

echo "--- password lengths ---"
docker exec gavle-web sh -c 'echo web_len=${#POSTGRES_PASSWORD}'
docker exec gavle-db  sh -c 'echo db_len=${#POSTGRES_PASSWORD}'

echo "--- db reachable + tables ---"
docker exec gavle-db psql -U gavle -d gavle -tAc \
  "select count(*) from information_schema.tables where table_schema='public'"

echo "--- web -> postgres:5432 ---"
docker exec gavle-web sh -c 'nc -zv postgres 5432 2>&1 || echo "nc not present"'

echo "--- env file keys ---"
grep -c . /home/deploy/gavle/.env.local
grep -o '^[A-Z_]*=' /home/deploy/gavle/.env.local | tr -d '=' | tr '\n' ' '
echo
