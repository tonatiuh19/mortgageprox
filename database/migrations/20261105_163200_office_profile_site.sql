-- Office address, personal profile, saved list views, and the branded site pages.

ALTER TABLE `tenants` ADD COLUMN `nmls` VARCHAR(40) DEFAULT NULL;
ALTER TABLE `tenants` ADD COLUMN `address_line` VARCHAR(160) DEFAULT NULL;
ALTER TABLE `tenants` ADD COLUMN `city` VARCHAR(80) DEFAULT NULL;
ALTER TABLE `tenants` ADD COLUMN `region` VARCHAR(40) DEFAULT NULL;
ALTER TABLE `tenants` ADD COLUMN `postal_code` VARCHAR(20) DEFAULT NULL;
ALTER TABLE `tenants` ADD COLUMN `letter_hold` TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE `tenant_users` ADD COLUMN `photo_url` VARCHAR(500) DEFAULT NULL;
ALTER TABLE `tenant_users` ADD COLUMN `nmls` VARCHAR(40) DEFAULT NULL;
ALTER TABLE `tenant_users` ADD COLUMN `bio` VARCHAR(500) DEFAULT NULL;
ALTER TABLE `tenant_users` ADD COLUMN `timezone` VARCHAR(64) DEFAULT NULL;
ALTER TABLE `tenant_users` ADD COLUMN `specializations` VARCHAR(240) DEFAULT NULL;
ALTER TABLE `tenant_users` ADD COLUMN `public_slug` VARCHAR(48) DEFAULT NULL;
ALTER TABLE `tenant_users` ADD COLUMN `notify_email` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `tenant_users` ADD COLUMN `notify_sms` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `tenant_users` ADD UNIQUE KEY `uq_tenant_user_slug` (`tenant_id`, `public_slug`);

CREATE TABLE IF NOT EXISTS `saved_filters` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `screen` VARCHAR(40) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `query_json` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_saved_filters` (`tenant_id`, `user_id`, `screen`),
  CONSTRAINT `fk_saved_filters_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_saved_filters_user` FOREIGN KEY (`user_id`) REFERENCES `tenant_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_site_pages` (
  `tenant_id` INT UNSIGNED NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `body_md` MEDIUMTEXT NOT NULL,
  PRIMARY KEY (`tenant_id`, `code`),
  CONSTRAINT `fk_site_pages_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
