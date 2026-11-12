INSERT INTO `modules` (`code`, `name_key`, `summary_key`, `category`, `kind`, `sort_order`)
SELECT 'transcripts', 'modules.transcripts.name', 'modules.transcripts.summary', 'communications', 'product', 315
WHERE NOT EXISTS (SELECT 1 FROM `modules` WHERE `code` = 'transcripts');

INSERT INTO `plan_modules` (`plan_id`, `module_code`)
SELECT p.id, 'transcripts' FROM `plans` p
WHERE p.code IN ('scale', 'custom')
AND NOT EXISTS (
  SELECT 1 FROM `plan_modules` existing WHERE existing.plan_id = p.id AND existing.module_code = 'transcripts'
);

ALTER TABLE `conversation_messages`
  ADD COLUMN `transcript` TEXT DEFAULT NULL AFTER `duration_sec`;
ALTER TABLE `conversation_messages`
  ADD COLUMN `transcript_emailed_at` DATETIME DEFAULT NULL AFTER `transcript`;

CREATE TABLE IF NOT EXISTS `mailboxes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(160) DEFAULT NULL,
  `assigned_user_id` INT UNSIGNED DEFAULT NULL,
  `status` ENUM('pending','connected','error') NOT NULL DEFAULT 'pending',
  `oauth_user_id` VARCHAR(120) DEFAULT NULL,
  `access_token` TEXT DEFAULT NULL,
  `refresh_token` TEXT DEFAULT NULL,
  `token_expires_at` DATETIME DEFAULT NULL,
  `last_error` VARCHAR(300) DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mailbox` (`tenant_id`, `email`),
  KEY `idx_mailbox_user` (`tenant_id`, `assigned_user_id`),
  CONSTRAINT `fk_mailboxes_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
