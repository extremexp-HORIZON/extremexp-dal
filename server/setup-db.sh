#!/bin/bash

MYSQL_PASSWORD=`pwgen 12 -1`

mysql -u root -p -e "CREATE USER 'expvis'@'localhost' IDENTIFIED BY '$MYSQL_PASSWORD';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON expvis.* TO 'expvis'@'localhost';"
mysql -u expvis --password="$MYSQL_PASSWORD" -e "CREATE database expvis;"

rm config/development.yaml
cat >> config/development.yaml <<EOT
mysql:
  password: $MYSQL_PASSWORD
EOT
