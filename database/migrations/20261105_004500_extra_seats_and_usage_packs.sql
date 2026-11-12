ALTER TABLE `tenant_subscriptions`
  ADD COLUMN `extra_seats` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `seats`;

ALTER TABLE `addons`
  ADD COLUMN `stripe_price_id` VARCHAR(80) DEFAULT NULL AFTER `billing`;

CREATE TABLE IF NOT EXISTS `usage_packs` (
  `code` VARCHAR(40) NOT NULL,
  `meter` VARCHAR(16) NOT NULL,
  `units` INT UNSIGNED NOT NULL,
  `price_cents` INT UNSIGNED NOT NULL,
  `name_key` VARCHAR(80) NOT NULL,
  `summary_key` VARCHAR(80) NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_usage_grants` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `meter` VARCHAR(16) NOT NULL,
  `units` INT UNSIGNED NOT NULL,
  `period_start` DATETIME DEFAULT NULL,
  `stripe_payment_intent_id` VARCHAR(80) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usage_grant_intent` (`stripe_payment_intent_id`),
  KEY `idx_usage_grants_tenant` (`tenant_id`, `meter`, `period_start`),
  CONSTRAINT `fk_usage_grants_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `usage_packs` (`code`, `meter`, `units`, `price_cents`, `name_key`, `summary_key`)
SELECT 'emails_500', 'emails', 500, 1500, 'billing.pack.emails', 'billing.pack.emailsSummary'
WHERE NOT EXISTS (SELECT 1 FROM `usage_packs` WHERE `code` = 'emails_500');

INSERT INTO `usage_packs` (`code`, `meter`, `units`, `price_cents`, `name_key`, `summary_key`)
SELECT 'letters_20', 'letters', 20, 2500, 'billing.pack.letters', 'billing.pack.lettersSummary'
WHERE NOT EXISTS (SELECT 1 FROM `usage_packs` WHERE `code` = 'letters_20');

INSERT INTO `usage_packs` (`code`, `meter`, `units`, `price_cents`, `name_key`, `summary_key`)
SELECT 'loans_20', 'loans', 20, 4900, 'billing.pack.loans', 'billing.pack.loansSummary'
WHERE NOT EXISTS (SELECT 1 FROM `usage_packs` WHERE `code` = 'loans_20');
