#!/usr/bin/env bash
set -e

# Wait for MySQL
until php artisan db:show --json 2>/dev/null | grep -q '"driver"'; do
  echo "Waiting for MySQL..." && sleep 2
done

php artisan migrate --force
php artisan tenants:migrate --force

# Seed only if the users table is empty (idempotent)
if ! php artisan tinker --execute="exit(App\Models\User::count() > 0 ? 0 : 1);" 2>/dev/null; then
  php artisan db:seed --force
fi

php artisan config:cache
php artisan route:cache

exec "$@"
