-- Portal favicon. The logo column already exists.

ALTER TABLE `tenants`
  ADD COLUMN `favicon_url` VARCHAR(500) DEFAULT NULL;
