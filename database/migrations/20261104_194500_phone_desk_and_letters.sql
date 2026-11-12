-- Pre-approval letters are chosen with Growth and above, not included in Starter.
UPDATE `modules` SET `category` = 'growth' WHERE `code` = 'letters';

DELETE pm FROM `plan_modules` pm
INNER JOIN `plans` p ON p.id = pm.plan_id
WHERE p.code = 'starter' AND pm.module_code = 'letters';

INSERT INTO `plan_modules` (`plan_id`, `module_code`)
SELECT p.id, 'letters' FROM `plans` p
WHERE p.code IN ('growth', 'scale', 'custom')
AND NOT EXISTS (
  SELECT 1 FROM `plan_modules` existing WHERE existing.plan_id = p.id AND existing.module_code = 'letters'
);

UPDATE `tenant_modules` tm
INNER JOIN `tenants` t ON t.id = tm.tenant_id
INNER JOIN `plans` p ON p.id = t.plan_id
SET tm.enabled = 0
WHERE tm.module_code = 'letters' AND p.code = 'starter';

ALTER TABLE `conversation_messages`
  ADD COLUMN `call_outcome` ENUM('answered','missed','forwarded','voicemail') DEFAULT NULL AFTER `status`;
ALTER TABLE `conversation_messages`
  ADD COLUMN `forwarded_to` VARCHAR(20) DEFAULT NULL AFTER `call_outcome`;
ALTER TABLE `conversation_messages`
  ADD COLUMN `duration_sec` INT UNSIGNED DEFAULT NULL AFTER `forwarded_to`;

CREATE TABLE IF NOT EXISTS `phone_lines` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `e164` VARCHAR(20) NOT NULL,
  `label` VARCHAR(80) NOT NULL,
  `assigned_user_id` INT UNSIGNED DEFAULT NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `ring_timeout_sec` TINYINT UNSIGNED NOT NULL DEFAULT 20,
  `voicemail_greeting` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_phone_line` (`tenant_id`, `e164`),
  KEY `idx_phone_line_user` (`tenant_id`, `assigned_user_id`),
  CONSTRAINT `fk_phone_lines_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_phone_settings` (
  `tenant_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `forwarding_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `forwarding_phone` VARCHAR(20) DEFAULT NULL,
  `voicemail_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `voicemail_greeting` VARCHAR(500) DEFAULT NULL,
  `browser_calls` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`, `user_id`),
  CONSTRAINT `fk_phone_settings_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `blocked_numbers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `e164` VARCHAR(20) NOT NULL,
  `note` VARCHAR(160) DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_blocked_number` (`tenant_id`, `e164`),
  CONSTRAINT `fk_blocked_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
