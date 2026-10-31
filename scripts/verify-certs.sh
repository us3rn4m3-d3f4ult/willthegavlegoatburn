#!/bin/sh
set -e
cd /home/deploy/gavle/infra/certs

chown deploy:deploy origin.pem origin.key
chmod 600 origin.pem origin.key

echo "--- files ---"
ls -l origin.pem origin.key

echo "--- cert ---"
openssl x509 -in origin.pem -noout -subject -issuer -dates

echo "--- alt names ---"
openssl x509 -in origin.pem -noout -ext subjectAltName 2>/dev/null || true

echo "--- cert modulus ---"
openssl x509 -in origin.pem -noout -modulus | openssl md5

echo "--- key modulus ---"
openssl rsa -in origin.key -noout -modulus 2>/dev/null | openssl md5
