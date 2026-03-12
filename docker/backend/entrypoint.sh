#!/usr/bin/env bash
set -e

# Wait for MySQL
until mysqladmin ping -h"${DB_HOST:-mysql}" -u"${DB_USERNAME}" -p"${DB_PASSWORD}" --skip-ssl --silent 2>/dev/null; do
  echo "Waiting for MySQL..." && sleep 2
done

php artisan migrate --force
php artisan tenants:migrate --force

# Seed only if the users table is empty (idempotent).
# Force QUEUE_CONNECTION=sync so tenant DB creation runs synchronously during seeding.
if ! php artisan tinker --execute="exit(App\Models\User::count() > 0 ? 0 : 1);" 2>/dev/null; then
  QUEUE_CONNECTION=sync php artisan db:seed --force
fi

php artisan config:cache
php artisan route:cache

exec "$@"
