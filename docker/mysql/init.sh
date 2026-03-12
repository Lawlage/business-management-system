#!/bin/bash
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<EOF
GRANT ALL PRIVILEGES ON \`tenant%\`.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
EOF
