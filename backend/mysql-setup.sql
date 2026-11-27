CREATE DATABASE IF NOT EXISTS smartpark
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'smartpark'@'localhost' IDENTIFIED BY 'smartpark';
CREATE USER IF NOT EXISTS 'smartpark'@'127.0.0.1' IDENTIFIED BY 'smartpark';

ALTER USER 'smartpark'@'localhost' IDENTIFIED BY 'smartpark';
ALTER USER 'smartpark'@'127.0.0.1' IDENTIFIED BY 'smartpark';

GRANT ALL PRIVILEGES ON smartpark.* TO 'smartpark'@'localhost';
GRANT ALL PRIVILEGES ON smartpark.* TO 'smartpark'@'127.0.0.1';

FLUSH PRIVILEGES;
