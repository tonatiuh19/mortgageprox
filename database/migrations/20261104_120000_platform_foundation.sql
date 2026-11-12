-- MortgageProx platform foundation: tenants, passwordless OTP, plans, pipeline.
-- TiDB Cloud Serverless / MySQL 8. Display copy lives in i18n, not in these rows.

CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` VARCHAR(80) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `modules` (
  `code` VARCHAR(40) NOT NULL,
  `name_key` VARCHAR(80) NOT NULL,
  `summary_key` VARCHAR(80) NOT NULL,
  `category` ENUM('core','growth','communications','premium') NOT NULL,
  `kind` ENUM('product','service') NOT NULL DEFAULT 'product',
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`code`),
  KEY `idx_modules_category` (`category`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `plans` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `name_key` VARCHAR(80) NOT NULL,
  `tagline_key` VARCHAR(80) NOT NULL,
  `price_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `seat_limit` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_public` TINYINT(1) NOT NULL DEFAULT 1,
  `is_quote` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plans_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `plan_modules` (
  `plan_id` INT UNSIGNED NOT NULL,
  `module_code` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`plan_id`, `module_code`),
  CONSTRAINT `fk_plan_modules_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plan_modules_module` FOREIGN KEY (`module_code`) REFERENCES `modules` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `addons` (
  `code` VARCHAR(40) NOT NULL,
  `name_key` VARCHAR(80) NOT NULL,
  `summary_key` VARCHAR(80) NOT NULL,
  `price_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `billing` ENUM('monthly','once','usage') NOT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `platform_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `role` ENUM('platform_owner','platform_support','platform_billing') NOT NULL DEFAULT 'platform_support',
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `preferred_language` ENUM('en','es') NOT NULL DEFAULT 'en',
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_platform_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenants` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `status` ENUM('trial','active','suspended') NOT NULL DEFAULT 'trial',
  `plan_id` INT UNSIGNED DEFAULT NULL,
  `owner_user_id` INT UNSIGNED DEFAULT NULL,
  `logo_url` VARCHAR(500) DEFAULT NULL,
  `primary_color` VARCHAR(20) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `support_email` VARCHAR(255) DEFAULT NULL,
  `custom_domain` VARCHAR(255) DEFAULT NULL,
  `trial_ends_at` DATETIME DEFAULT NULL,
  `wizard_json` JSON DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenants_slug` (`slug`),
  KEY `idx_tenants_status` (`status`, `created_at`),
  KEY `idx_tenants_plan` (`plan_id`),
  CONSTRAINT `fk_tenants_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_subscriptions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `plan_id` INT UNSIGNED NOT NULL,
  `status` ENUM('trial','active','canceled') NOT NULL DEFAULT 'trial',
  `seats` INT UNSIGNED NOT NULL DEFAULT 3,
  `trial_ends_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscription_tenant` (`tenant_id`),
  CONSTRAINT `fk_subscription_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_subscription_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_modules` (
  `tenant_id` INT UNSIGNED NOT NULL,
  `module_code` VARCHAR(40) NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`tenant_id`, `module_code`),
  CONSTRAINT `fk_tenant_modules_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tenant_modules_module` FOREIGN KEY (`module_code`) REFERENCES `modules` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_addons` (
  `tenant_id` INT UNSIGNED NOT NULL,
  `addon_code` VARCHAR(40) NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`tenant_id`, `addon_code`),
  CONSTRAINT `fk_tenant_addons_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tenant_addons_addon` FOREIGN KEY (`addon_code`) REFERENCES `addons` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `role` ENUM('brokerage_owner','leadership','loan_officer','processor','partner') NOT NULL,
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `preferred_language` ENUM('en','es') NOT NULL DEFAULT 'en',
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_users_email` (`email`),
  KEY `idx_tenant_users_tenant` (`tenant_id`, `role`),
  CONSTRAINT `fk_tenant_users_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `borrowers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `email` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `preferred_language` ENUM('en','es') NOT NULL DEFAULT 'en',
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_borrowers_email_tenant` (`tenant_id`, `email`),
  KEY `idx_borrowers_email` (`email`),
  CONSTRAINT `fk_borrowers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor` ENUM('platform','brokerage','borrower') NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `code_hash` CHAR(64) NOT NULL,
  `purpose` ENUM('login') NOT NULL DEFAULT 'login',
  `attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME DEFAULT NULL,
  `ip_address` VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_lookup` (`actor`, `user_id`, `purpose`, `consumed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor` ENUM('platform','brokerage','borrower') NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_token` (`token_hash`),
  KEY `idx_sessions_user` (`actor`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pipeline_stages` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_funded` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_stages_tenant` (`tenant_id`, `sort_order`),
  CONSTRAINT `fk_stages_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `clients` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `assigned_user_id` INT UNSIGNED DEFAULT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `source` VARCHAR(80) DEFAULT NULL,
  `status` ENUM('lead','active','archived') NOT NULL DEFAULT 'lead',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_clients_tenant` (`tenant_id`, `status`, `created_at`),
  KEY `idx_clients_assigned` (`assigned_user_id`),
  CONSTRAINT `fk_clients_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_clients_assigned` FOREIGN KEY (`assigned_user_id`) REFERENCES `tenant_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `client_groups` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `kind` ENUM('household','vip','other') NOT NULL DEFAULT 'household',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_groups_tenant` (`tenant_id`),
  CONSTRAINT `fk_groups_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `client_group_members` (
  `group_id` INT UNSIGNED NOT NULL,
  `client_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`group_id`, `client_id`),
  CONSTRAINT `fk_group_members_group` FOREIGN KEY (`group_id`) REFERENCES `client_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_group_members_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `realtors` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `assigned_user_id` INT UNSIGNED DEFAULT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `brokerage_name` VARCHAR(160) DEFAULT NULL,
  `status` ENUM('partner','prospect','archived') NOT NULL DEFAULT 'prospect',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_realtors_tenant` (`tenant_id`, `status`),
  CONSTRAINT `fk_realtors_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `loans` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `client_id` INT UNSIGNED NOT NULL,
  `assigned_user_id` INT UNSIGNED DEFAULT NULL,
  `stage_id` INT UNSIGNED DEFAULT NULL,
  `purpose` ENUM('purchase','refinance') NOT NULL DEFAULT 'purchase',
  `amount_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('open','funded','archived') NOT NULL DEFAULT 'open',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_loans_tenant_stage` (`tenant_id`, `stage_id`, `status`),
  KEY `idx_loans_client` (`client_id`),
  CONSTRAINT `fk_loans_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_loans_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_loans_stage` FOREIGN KEY (`stage_id`) REFERENCES `pipeline_stages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_loans_assigned` FOREIGN KEY (`assigned_user_id`) REFERENCES `tenant_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tasks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `loan_id` INT UNSIGNED DEFAULT NULL,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `title` VARCHAR(200) NOT NULL,
  `status` ENUM('open','done') NOT NULL DEFAULT 'open',
  `due_on` DATE DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tasks_tenant` (`tenant_id`, `status`),
  CONSTRAINT `fk_tasks_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED DEFAULT NULL,
  `actor_type` ENUM('platform','brokerage','borrower','system') NOT NULL,
  `actor_id` INT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(80) NOT NULL,
  `summary` VARCHAR(255) NOT NULL,
  `metadata_json` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_tenant` (`tenant_id`, `created_at`),
  KEY `idx_activity_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `description`)
SELECT 'app_version', '0.1.0', 'Current deployed application version'
WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `setting_key` = 'app_version');

INSERT IGNORE INTO `modules` (`code`, `name_key`, `summary_key`, `category`, `kind`, `sort_order`) VALUES
('website', 'modules.website.name', 'modules.website.summary', 'core', 'product', 10),
('application', 'modules.application.name', 'modules.application.summary', 'core', 'product', 20),
('pipeline', 'modules.pipeline.name', 'modules.pipeline.summary', 'core', 'product', 30),
('clients', 'modules.clients.name', 'modules.clients.summary', 'core', 'product', 40),
('groups', 'modules.groups.name', 'modules.groups.summary', 'core', 'product', 50),
('tasks', 'modules.tasks.name', 'modules.tasks.summary', 'core', 'product', 60),
('compliance', 'modules.compliance.name', 'modules.compliance.summary', 'core', 'product', 70),
('letters', 'modules.letters.name', 'modules.letters.summary', 'core', 'product', 80),
('calculators', 'modules.calculators.name', 'modules.calculators.summary', 'core', 'product', 90),
('templates', 'modules.templates.name', 'modules.templates.summary', 'core', 'product', 100),
('portal', 'modules.portal.name', 'modules.portal.summary', 'core', 'product', 110),
('dashboard', 'modules.dashboard.name', 'modules.dashboard.summary', 'core', 'product', 120),
('notifications', 'modules.notifications.name', 'modules.notifications.summary', 'core', 'product', 130),
('activity', 'modules.activity.name', 'modules.activity.summary', 'core', 'product', 140),
('team', 'modules.team.name', 'modules.team.summary', 'core', 'product', 150),
('brand', 'modules.brand.name', 'modules.brand.summary', 'core', 'product', 160),
('realtors', 'modules.realtors.name', 'modules.realtors.summary', 'growth', 'product', 200),
('scheduler', 'modules.scheduler.name', 'modules.scheduler.summary', 'growth', 'product', 210),
('calendar', 'modules.calendar.name', 'modules.calendar.summary', 'growth', 'product', 220),
('automations', 'modules.automations.name', 'modules.automations.summary', 'growth', 'product', 230),
('conversations', 'modules.conversations.name', 'modules.conversations.summary', 'communications', 'product', 300),
('phone', 'modules.phone.name', 'modules.phone.summary', 'communications', 'product', 310),
('email', 'modules.email.name', 'modules.email.summary', 'communications', 'product', 320),
('broadcasts', 'modules.broadcasts.name', 'modules.broadcasts.summary', 'communications', 'product', 330),
('ai', 'modules.ai.name', 'modules.ai.summary', 'premium', 'product', 400),
('credit', 'modules.credit.name', 'modules.credit.summary', 'premium', 'product', 410);

INSERT INTO `plans` (`code`, `name_key`, `tagline_key`, `price_cents`, `seat_limit`, `is_public`, `is_quote`, `sort_order`)
SELECT 'starter', 'plans.starter.name', 'plans.starter.tagline', 14900, 3, 1, 0, 10
WHERE NOT EXISTS (SELECT 1 FROM `plans` WHERE `code` = 'starter');
INSERT INTO `plans` (`code`, `name_key`, `tagline_key`, `price_cents`, `seat_limit`, `is_public`, `is_quote`, `sort_order`)
SELECT 'growth', 'plans.growth.name', 'plans.growth.tagline', 34900, 10, 1, 0, 20
WHERE NOT EXISTS (SELECT 1 FROM `plans` WHERE `code` = 'growth');
INSERT INTO `plans` (`code`, `name_key`, `tagline_key`, `price_cents`, `seat_limit`, `is_public`, `is_quote`, `sort_order`)
SELECT 'scale', 'plans.scale.name', 'plans.scale.tagline', 69900, 25, 1, 0, 30
WHERE NOT EXISTS (SELECT 1 FROM `plans` WHERE `code` = 'scale');
INSERT INTO `plans` (`code`, `name_key`, `tagline_key`, `price_cents`, `seat_limit`, `is_public`, `is_quote`, `sort_order`)
SELECT 'custom', 'plans.custom.name', 'plans.custom.tagline', 0, 0, 1, 1, 40
WHERE NOT EXISTS (SELECT 1 FROM `plans` WHERE `code` = 'custom');

INSERT INTO `plan_modules` (`plan_id`, `module_code`)
SELECT p.id, m.code FROM `plans` p JOIN `modules` m
WHERE p.code = 'starter' AND m.category = 'core'
AND NOT EXISTS (SELECT 1 FROM `plan_modules` pm WHERE pm.plan_id = p.id AND pm.module_code = m.code);

INSERT INTO `plan_modules` (`plan_id`, `module_code`)
SELECT p.id, m.code FROM `plans` p JOIN `modules` m
WHERE p.code = 'growth' AND m.category IN ('core', 'growth')
AND NOT EXISTS (SELECT 1 FROM `plan_modules` pm WHERE pm.plan_id = p.id AND pm.module_code = m.code);

INSERT INTO `plan_modules` (`plan_id`, `module_code`)
SELECT p.id, m.code FROM `plans` p JOIN `modules` m
WHERE p.code IN ('scale', 'custom') AND m.kind = 'product'
AND NOT EXISTS (SELECT 1 FROM `plan_modules` pm WHERE pm.plan_id = p.id AND pm.module_code = m.code);

INSERT IGNORE INTO `addons` (`code`, `name_key`, `summary_key`, `price_cents`, `billing`, `sort_order`) VALUES
('custom_styles', 'addons.customStyles.name', 'addons.customStyles.summary', 250000, 'once', 10),
('twilio', 'addons.twilio.name', 'addons.twilio.summary', 9900, 'monthly', 20),
('custom_domain', 'addons.customDomain.name', 'addons.customDomain.summary', 1900, 'monthly', 30),
('extra_seat', 'addons.extraSeat.name', 'addons.extraSeat.summary', 2900, 'monthly', 40);

INSERT INTO `platform_users` (`email`, `first_name`, `last_name`, `role`, `status`)
SELECT 'alex@disruptinglabs.com', 'Alex', 'Gomez', 'platform_owner', 'active'
WHERE NOT EXISTS (SELECT 1 FROM `platform_users` WHERE `email` = 'alex@disruptinglabs.com');
