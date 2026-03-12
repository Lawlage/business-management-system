FROM php:8.2-fpm-alpine AS base

RUN apk add --no-cache \
    libpng-dev libzip-dev oniguruma-dev mysql-client bash \
  && docker-php-ext-install pdo_mysql mbstring zip bcmath pcntl opcache

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

COPY backend/ .
RUN chown -R www-data:www-data storage bootstrap/cache

COPY docker/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["php-fpm"]
