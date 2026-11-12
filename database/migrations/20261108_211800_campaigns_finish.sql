-- Finish campaigns after the first file stopped before the contact columns existed.
-- Every statement is safe to run again.

ALTER TABLE `plans`
  ADD COLUMN IF NOT EXISTS `included_campaign_contacts` INT UNSIGNED NULL DEFAULT NULL AFTER `included_voice_minutes`;

UPDATE `plans` SET `included_campaign_contacts` = 800 WHERE `code` IN ('scale', 'custom');

ALTER TABLE `tenant_subscriptions`
  ADD COLUMN IF NOT EXISTS `campaign_packs` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `extra_seats`;

ALTER TABLE `tenant_subscriptions`
  ADD COLUMN IF NOT EXISTS `campaign_included` INT UNSIGNED NULL DEFAULT NULL AFTER `campaign_packs`;

CREATE TABLE IF NOT EXISTS `platform_settings` (
  `setting_key` VARCHAR(64) NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `platform_settings` (`setting_key`, `setting_value`)
SELECT 'campaign_contact_ceiling', '1000'
WHERE NOT EXISTS (SELECT 1 FROM `platform_settings` WHERE `setting_key` = 'campaign_contact_ceiling');

INSERT IGNORE INTO `modules` (`code`, `name_key`, `summary_key`, `category`, `kind`, `sort_order`) VALUES
('campaigns', 'modules.campaigns.name', 'modules.campaigns.summary', 'premium', 'product', 430);

INSERT INTO `plan_modules` (`plan_id`, `module_code`)
SELECT p.id, 'campaigns' FROM `plans` p
WHERE p.code IN ('scale', 'custom')
AND NOT EXISTS (
  SELECT 1 FROM `plan_modules` pm WHERE pm.plan_id = p.id AND pm.module_code = 'campaigns'
);

INSERT IGNORE INTO `addons` (`code`, `name_key`, `summary_key`, `price_cents`, `billing`, `sort_order`) VALUES
('campaign_pack', 'addons.campaignPack.name', 'addons.campaignPack.summary', 900, 'monthly', 50);

CREATE TABLE IF NOT EXISTS `campaign_topics` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `resend_topic_id` VARCHAR(80) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_campaign_topics_name` (`tenant_id`, `name`),
  CONSTRAINT `fk_campaign_topics_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaign_contacts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(160) NOT NULL DEFAULT '',
  `status` ENUM('subscribed','unsubscribed') NOT NULL DEFAULT 'subscribed',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unsubscribed_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_campaign_contacts_email` (`tenant_id`, `email`),
  KEY `idx_campaign_contacts_status` (`status`, `email`),
  CONSTRAINT `fk_campaign_contacts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaign_subscriptions` (
  `contact_id` BIGINT UNSIGNED NOT NULL,
  `topic_id` INT UNSIGNED NOT NULL,
  `status` ENUM('subscribed','unsubscribed') NOT NULL DEFAULT 'subscribed',
  PRIMARY KEY (`contact_id`, `topic_id`),
  KEY `idx_campaign_subscriptions_topic` (`topic_id`, `status`),
  CONSTRAINT `fk_campaign_subscriptions_contact` FOREIGN KEY (`contact_id`) REFERENCES `campaign_contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_campaign_subscriptions_topic` FOREIGN KEY (`topic_id`) REFERENCES `campaign_topics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `topic_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(140) NOT NULL,
  `subject` VARCHAR(200) NOT NULL,
  `body` MEDIUMTEXT NOT NULL,
  `status` ENUM('draft','sent','failed') NOT NULL DEFAULT 'draft',
  `audience_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `opened_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `clicked_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `resend_broadcast_id` VARCHAR(80) DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_campaigns_tenant` (`tenant_id`, `created_at`),
  KEY `idx_campaigns_broadcast` (`resend_broadcast_id`),
  CONSTRAINT `fk_campaigns_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_campaigns_topic` FOREIGN KEY (`topic_id`) REFERENCES `campaign_topics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaign_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `campaign_id` BIGINT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `event_type` ENUM('opened','clicked','unsubscribed') NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_campaign_events` (`campaign_id`, `email`, `event_type`),
  CONSTRAINT `fk_campaign_events_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
