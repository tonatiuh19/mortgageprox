-- MortgageProx schema source of truth (TiDB Cloud / MySQL 8).
-- Change schema only by adding database/migrations, applying them, then refreshing this file.

CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `filename` VARCHAR(255) NOT NULL,
  `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MortgageProx platform foundation: tenants, passwordless OTP, plans, pipeline.
-- TiDB Cloud Serverless / MySQL 8. Display copy lives in i18n, not in these rows.

CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` VARCHAR(80) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `legal_pages` (
  `code` VARCHAR(20) NOT NULL,
  `body_md` MEDIUMTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`)
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
  `trial_fee_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `included_loans` INT UNSIGNED NULL DEFAULT NULL,
  `included_emails` INT UNSIGNED NULL DEFAULT NULL,
  `included_letters` INT UNSIGNED NULL DEFAULT NULL,
  `included_sms` INT UNSIGNED NULL DEFAULT NULL,
  `included_voice_minutes` INT UNSIGNED NULL DEFAULT NULL,
  `included_campaign_contacts` INT UNSIGNED NULL DEFAULT NULL,
  `stripe_price_id` VARCHAR(80) DEFAULT NULL,
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
  `stripe_price_id` VARCHAR(80) DEFAULT NULL,
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
  `favicon_url` VARCHAR(500) DEFAULT NULL,
  `primary_color` VARCHAR(20) DEFAULT NULL,
  `brand_radius` VARCHAR(12) NOT NULL DEFAULT 'soft',
  `brand_headline` VARCHAR(12) NOT NULL DEFAULT 'serif',
  `phone` VARCHAR(20) DEFAULT NULL,
  `nmls` VARCHAR(40) DEFAULT NULL,
  `address_line` VARCHAR(160) DEFAULT NULL,
  `city` VARCHAR(80) DEFAULT NULL,
  `region` VARCHAR(40) DEFAULT NULL,
  `postal_code` VARCHAR(20) DEFAULT NULL,
  `letter_hold` TINYINT(1) NOT NULL DEFAULT 0,
  `support_email` VARCHAR(255) DEFAULT NULL,
  `custom_domain` VARCHAR(255) DEFAULT NULL,
  `mcp_token_hash` CHAR(64) DEFAULT NULL,
  `mcp_token_prefix` VARCHAR(12) DEFAULT NULL,
  `trial_ends_at` DATETIME DEFAULT NULL,
  `wizard_json` JSON DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenants_slug` (`slug`),
  UNIQUE KEY `uq_tenants_custom_domain` (`custom_domain`),
  UNIQUE KEY `uq_tenants_mcp_token` (`mcp_token_hash`),
  KEY `idx_tenants_status` (`status`, `created_at`),
  KEY `idx_tenants_plan` (`plan_id`),
  CONSTRAINT `fk_tenants_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_legal_pages` (
  `tenant_id` INT UNSIGNED NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `body_md` MEDIUMTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`, `code`),
  CONSTRAINT `fk_tenant_legal_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `tenant_subscriptions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `plan_id` INT UNSIGNED NOT NULL,
  `status` ENUM('trial','active','canceled') NOT NULL DEFAULT 'trial',
  `seats` INT UNSIGNED NOT NULL DEFAULT 3,
  `extra_seats` INT UNSIGNED NOT NULL DEFAULT 0,
  `campaign_packs` INT UNSIGNED NOT NULL DEFAULT 0,
  `campaign_included` INT UNSIGNED NULL DEFAULT NULL,
  `trial_ends_at` DATETIME DEFAULT NULL,
  `start_fee_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `start_fee_status` VARCHAR(12) NOT NULL DEFAULT 'none',
  `stripe_customer_id` VARCHAR(80) DEFAULT NULL,
  `stripe_subscription_id` VARCHAR(80) DEFAULT NULL,
  `stripe_checkout_session_id` VARCHAR(80) DEFAULT NULL,
  `start_fee_credit_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscription_tenant` (`tenant_id`),
  CONSTRAINT `fk_subscription_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_subscription_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wizard_intents` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `payload_json` JSON NOT NULL,
  `payload_hash` CHAR(64) NOT NULL,
  `amount_cents` INT UNSIGNED NOT NULL,
  `stripe_customer_id` VARCHAR(80) DEFAULT NULL,
  `stripe_checkout_session_id` VARCHAR(80) DEFAULT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'open',
  `tenant_id` INT UNSIGNED DEFAULT NULL,
  `email_sent` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wizard_intent_session` (`stripe_checkout_session_id`),
  KEY `idx_wizard_intents_email` (`email`, `payload_hash`, `status`)
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

CREATE TABLE IF NOT EXISTS `tenant_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `photo_url` VARCHAR(500) DEFAULT NULL,
  `nmls` VARCHAR(40) DEFAULT NULL,
  `bio` VARCHAR(500) DEFAULT NULL,
  `timezone` VARCHAR(64) DEFAULT NULL,
  `specializations` VARCHAR(240) DEFAULT NULL,
  `public_slug` VARCHAR(48) DEFAULT NULL,
  `apply_token` VARCHAR(40) DEFAULT NULL,
  `website_url` VARCHAR(240) DEFAULT NULL,
  `linkedin_url` VARCHAR(240) DEFAULT NULL,
  `facebook_url` VARCHAR(240) DEFAULT NULL,
  `instagram_url` VARCHAR(240) DEFAULT NULL,
  `youtube_url` VARCHAR(240) DEFAULT NULL,
  `notify_email` TINYINT(1) NOT NULL DEFAULT 1,
  `notify_sms` TINYINT(1) NOT NULL DEFAULT 0,
  `notify_also` VARCHAR(255) DEFAULT NULL,
  `notify_events` VARCHAR(240) DEFAULT NULL,
  `role` ENUM('brokerage_owner','leadership','loan_officer','processor','partner') NOT NULL,
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `preferred_language` ENUM('en','es') NOT NULL DEFAULT 'en',
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_users_email` (`email`),
  UNIQUE KEY `uq_tenant_user_slug` (`tenant_id`, `public_slug`),
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
  `address_line` VARCHAR(160) DEFAULT NULL,
  `city` VARCHAR(80) DEFAULT NULL,
  `region` VARCHAR(40) DEFAULT NULL,
  `postal_code` VARCHAR(20) DEFAULT NULL,
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
  `code` VARCHAR(40) DEFAULT NULL,
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
  `birthday` DATE DEFAULT NULL,
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
  `property_value_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `down_payment_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `property_type` VARCHAR(40) NOT NULL DEFAULT 'single_family',
  `address_line` VARCHAR(160) DEFAULT NULL,
  `city` VARCHAR(80) DEFAULT NULL,
  `region` VARCHAR(40) DEFAULT NULL,
  `postal_code` VARCHAR(20) DEFAULT NULL,
  `application_on` DATE DEFAULT NULL,
  `submitted_on` DATE DEFAULT NULL,
  `est_close_on` DATE DEFAULT NULL,
  `partner_user_id` INT UNSIGNED DEFAULT NULL,
  `realtor_id` INT UNSIGNED DEFAULT NULL,
  `preapproval_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `preapproval_max_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `preapproval_expires_on` DATE DEFAULT NULL,
  `letter_active` TINYINT(1) NOT NULL DEFAULT 0,
  `employer` VARCHAR(160) DEFAULT NULL,
  `job_title` VARCHAR(120) DEFAULT NULL,
  `annual_income_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `income_type` VARCHAR(40) DEFAULT NULL,
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
  `assigned_user_id` INT UNSIGNED DEFAULT NULL,
  `title` VARCHAR(200) NOT NULL,
  `status` ENUM('open','done') NOT NULL DEFAULT 'open',
  `column_key` ENUM('todo','doing','waiting','done') NOT NULL DEFAULT 'todo',
  `priority` ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `detail` VARCHAR(500) DEFAULT NULL,
  `completion_note` VARCHAR(500) DEFAULT NULL,
  `category` VARCHAR(80) DEFAULT NULL,
  `due_on` DATE DEFAULT NULL,
  `due_at` DATETIME DEFAULT NULL,
  `position` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tasks_board` (`tenant_id`, `column_key`, `position`),
  CONSTRAINT `fk_tasks_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tasks_assignee` FOREIGN KEY (`assigned_user_id`) REFERENCES `tenant_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_reminders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `task_id` INT UNSIGNED NOT NULL,
  `kind` ENUM('before','at') NOT NULL,
  `fire_at` DATETIME NOT NULL,
  `sent_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_task_reminder` (`task_id`, `kind`),
  KEY `idx_task_reminders_due` (`sent_at`, `fire_at`),
  CONSTRAINT `fk_task_reminders_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS `tenant_sections` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `section_id` VARCHAR(40) NOT NULL,
  `module_code` VARCHAR(40) NOT NULL,
  `custom_label` VARCHAR(80) DEFAULT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `nav_group` ENUM('home','grow','inbox','people','files','setup') NOT NULL,
  `is_hidden` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_section` (`tenant_id`, `section_id`),
  CONSTRAINT `fk_tenant_sections_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_role_sections` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `role` ENUM('brokerage_owner','leadership','loan_officer','processor','partner') NOT NULL,
  `section_id` VARCHAR(40) NOT NULL,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_role_section` (`tenant_id`, `role`, `section_id`),
  CONSTRAINT `fk_role_sections_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contacts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `assigned_user_id` INT UNSIGNED DEFAULT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `company` VARCHAR(160) DEFAULT NULL,
  `kind` ENUM('person','realtor','vendor') NOT NULL DEFAULT 'person',
  `notes` TEXT,
  `status` ENUM('active','archived','converted') NOT NULL DEFAULT 'active',
  `client_id` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contacts_tenant` (`tenant_id`, `status`, `created_at`),
  CONSTRAINT `fk_contacts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contacts_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `conversation_threads` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `contact_id` INT UNSIGNED DEFAULT NULL,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `loan_id` INT UNSIGNED DEFAULT NULL,
  `channel` ENUM('sms','email','call','note') NOT NULL DEFAULT 'note',
  `subject` VARCHAR(160) NOT NULL,
  `status` ENUM('open','closed') NOT NULL DEFAULT 'open',
  `unread_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_message_at` DATETIME DEFAULT NULL,
  `assigned_user_id` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_threads_tenant` (`tenant_id`, `last_message_at`),
  CONSTRAINT `fk_threads_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_threads_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_threads_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `conversation_messages` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `thread_id` INT UNSIGNED NOT NULL,
  `direction` ENUM('in','out') NOT NULL,
  `channel` ENUM('sms','email','call','note') NOT NULL,
  `body` TEXT NOT NULL,
  `status` ENUM('received','queued','sent','failed') NOT NULL,
  `call_outcome` ENUM('answered','missed','forwarded','voicemail') DEFAULT NULL,
  `forwarded_to` VARCHAR(20) DEFAULT NULL,
  `duration_sec` INT UNSIGNED DEFAULT NULL,
  `transcript` TEXT DEFAULT NULL,
  `transcript_emailed_at` DATETIME DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messages_thread` (`thread_id`, `id`),
  CONSTRAINT `fk_messages_thread` FOREIGN KEY (`thread_id`) REFERENCES `conversation_threads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `block_calls` TINYINT(1) NOT NULL DEFAULT 1,
  `block_texts` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_blocked_number` (`tenant_id`, `e164`),
  CONSTRAINT `fk_blocked_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `appointments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `public_token` VARCHAR(40) DEFAULT NULL,
  `name` VARCHAR(160) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `starts_at` DATETIME NOT NULL,
  `note` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('requested','confirmed','done') NOT NULL DEFAULT 'requested',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_appointments_tenant` (`tenant_id`, `starts_at`),
  CONSTRAINT `fk_appointments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `loan_documents` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `loan_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `status` ENUM('needed','received','reviewed','waived') NOT NULL DEFAULT 'needed',
  `file_name` VARCHAR(160) DEFAULT NULL,
  `file_type` VARCHAR(80) DEFAULT NULL,
  `file_blob` MEDIUMBLOB DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_documents_loan` (`tenant_id`, `loan_id`),
  CONSTRAINT `fk_documents_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `compliance_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `loan_id` INT UNSIGNED NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `label` VARCHAR(160) NOT NULL,
  `status` ENUM('pending','done','waived') NOT NULL DEFAULT 'pending',
  `due_on` DATE DEFAULT NULL,
  `document_id` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_compliance_loan` (`tenant_id`, `loan_id`),
  CONSTRAINT `fk_compliance_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `message_templates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `channel` ENUM('sms','email','note') NOT NULL DEFAULT 'note',
  `subject` VARCHAR(160) DEFAULT NULL,
  `body` TEXT NOT NULL,
  `greeting` VARCHAR(160) DEFAULT NULL,
  `headline` VARCHAR(200) DEFAULT NULL,
  `button_label` VARCHAR(80) DEFAULT NULL,
  `button_url` VARCHAR(500) DEFAULT NULL,
  `details_json` JSON DEFAULT NULL,
  `footer` VARCHAR(240) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_templates_tenant` (`tenant_id`, `name`),
  CONSTRAINT `fk_templates_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `platform_emails` (
  `code` VARCHAR(40) NOT NULL,
  `subject` VARCHAR(160) NOT NULL,
  `greeting` VARCHAR(160) NOT NULL,
  `headline` VARCHAR(200) NOT NULL,
  `body_text` TEXT NOT NULL,
  `button_label` VARCHAR(80) DEFAULT NULL,
  `button_url` VARCHAR(500) DEFAULT NULL,
  `details_json` JSON NOT NULL,
  `footer` VARCHAR(240) NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `platform_emails` (`code`, `subject`, `greeting`, `headline`, `body_text`, `button_label`, `button_url`, `details_json`, `footer`)
SELECT 'sign_in', 'Your MortgageProx sign-in code', 'Hello,', 'Your sign-in code',
  'Use this code to enter MortgageProx. It expires in {{minutes}} minutes. If you did not ask for this, you can ignore this email.',
  'Go to sign in', '{{loginUrl}}',
  JSON_ARRAY(JSON_OBJECT('label', 'Code', 'value', '{{code}}')),
  'MortgageProx is not a bank and does not approve loans.'
WHERE NOT EXISTS (SELECT 1 FROM `platform_emails` WHERE `code` = 'sign_in');

INSERT INTO `platform_emails` (`code`, `subject`, `greeting`, `headline`, `body_text`, `button_label`, `button_url`, `details_json`, `footer`)
SELECT 'workspace_ready', 'Your office is open', 'Hello {{firstName}},', 'You''re in.',
  '{{brokerage}} is open. This code is here if you come back on another device. It expires in {{minutes}} minutes.',
  'Enter your office', '{{appUrl}}',
  JSON_ARRAY(JSON_OBJECT('label', 'Address', 'value', '{{host}}'), JSON_OBJECT('label', 'Code', 'value', '{{code}}')),
  'MortgageProx is not a bank and does not approve loans.'
WHERE NOT EXISTS (SELECT 1 FROM `platform_emails` WHERE `code` = 'workspace_ready');

INSERT INTO `platform_emails` (`code`, `subject`, `greeting`, `headline`, `body_text`, `button_label`, `button_url`, `details_json`, `footer`)
SELECT 'invite', 'You are invited to {{brokerage}}', 'Hello {{firstName}},', 'Your seat is ready.',
  '{{inviter}} added you to {{brokerage}}. Use this code to sign in. It expires in {{minutes}} minutes.',
  'Go to sign in', '{{loginUrl}}',
  JSON_ARRAY(JSON_OBJECT('label', 'Office', 'value', '{{brokerage}}'), JSON_OBJECT('label', 'Code', 'value', '{{code}}')),
  'You are receiving this because someone at {{brokerage}} created an account for you.'
WHERE NOT EXISTS (SELECT 1 FROM `platform_emails` WHERE `code` = 'invite');

INSERT INTO `platform_emails` (`code`, `subject`, `greeting`, `headline`, `body_text`, `button_label`, `button_url`, `details_json`, `footer`)
SELECT 'transcript', 'Call transcript', 'Hello {{firstName}},', 'The words from the call',
  '{{transcript}}',
  'Open your office', '{{appUrl}}',
  JSON_ARRAY(),
  'Sent from MortgageProx for your office.'
WHERE NOT EXISTS (SELECT 1 FROM `platform_emails` WHERE `code` = 'transcript');

CREATE TABLE IF NOT EXISTS `reminder_flows` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(400) DEFAULT NULL,
  `trigger_kind` ENUM('stage_enter','manual') NOT NULL DEFAULT 'stage_enter',
  `stage_id` INT UNSIGNED DEFAULT NULL,
  `channel` ENUM('sms','email') NOT NULL DEFAULT 'email',
  `delay_hours` INT UNSIGNED NOT NULL DEFAULT 0,
  `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `stop_on_reply` TINYINT(1) NOT NULL DEFAULT 1,
  `quiet_start_hour` TINYINT UNSIGNED NOT NULL DEFAULT 9,
  `quiet_end_hour` TINYINT UNSIGNED NOT NULL DEFAULT 19,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_flows_tenant` (`tenant_id`, `enabled`),
  CONSTRAINT `fk_flows_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_flows_stage` FOREIGN KEY (`stage_id`) REFERENCES `pipeline_stages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reminder_flow_steps` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `flow_id` INT UNSIGNED NOT NULL,
  `step_key` VARCHAR(40) NOT NULL,
  `step_type` ENUM('trigger','wait','send_email','send_sms','notify_staff','condition','wait_for_reply','end') NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `template_id` INT UNSIGNED DEFAULT NULL,
  `config_json` JSON DEFAULT NULL,
  `position_x` FLOAT NOT NULL DEFAULT 0,
  `position_y` FLOAT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_flow_step` (`flow_id`, `step_key`),
  CONSTRAINT `fk_flow_steps_flow` FOREIGN KEY (`flow_id`) REFERENCES `reminder_flows` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_flow_steps_template` FOREIGN KEY (`template_id`) REFERENCES `message_templates` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reminder_flow_edges` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `flow_id` INT UNSIGNED NOT NULL,
  `source_key` VARCHAR(40) NOT NULL,
  `target_key` VARCHAR(40) NOT NULL,
  `edge_type` ENUM('next','yes','no','replied','no_reply') NOT NULL DEFAULT 'next',
  PRIMARY KEY (`id`),
  KEY `idx_flow_edges` (`flow_id`, `source_key`),
  CONSTRAINT `fk_flow_edges_flow` FOREIGN KEY (`flow_id`) REFERENCES `reminder_flows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reminder_flow_runs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `flow_id` INT UNSIGNED NOT NULL,
  `loan_id` INT UNSIGNED NOT NULL,
  `client_id` INT UNSIGNED NOT NULL,
  `status` ENUM('active','paused','completed','stopped','failed') NOT NULL DEFAULT 'active',
  `live_key` VARCHAR(40) DEFAULT NULL,
  `current_step_key` VARCHAR(40) DEFAULT NULL,
  `next_run_at` DATETIME DEFAULT NULL,
  `waiting_since` DATETIME DEFAULT NULL,
  `end_reason` VARCHAR(160) DEFAULT NULL,
  `entered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_flow_runs_live` (`live_key`),
  KEY `idx_flow_runs_due` (`status`, `next_run_at`),
  KEY `idx_flow_runs_loan` (`loan_id`),
  CONSTRAINT `fk_flow_runs_flow` FOREIGN KEY (`flow_id`) REFERENCES `reminder_flows` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_flow_runs_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reminder_flow_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `run_id` INT UNSIGNED NOT NULL,
  `flow_id` INT UNSIGNED NOT NULL,
  `step_key` VARCHAR(40) DEFAULT NULL,
  `event` ENUM('entered','sent','skipped','failed','replied','stopped','completed','paused') NOT NULL,
  `channel` ENUM('email','sms','staff','none') NOT NULL DEFAULT 'none',
  `detail` VARCHAR(240) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_flow_events_run` (`run_id`, `id`),
  CONSTRAINT `fk_flow_events_run` FOREIGN KEY (`run_id`) REFERENCES `reminder_flow_runs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `broadcasts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `channel` ENUM('sms','email') NOT NULL,
  `audience` ENUM('clients','contacts','realtors') NOT NULL,
  `body` TEXT NOT NULL,
  `template_id` INT UNSIGNED DEFAULT NULL,
  `status` ENUM('draft','queued','sent','partial','failed') NOT NULL DEFAULT 'queued',
  `recipient_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `sent_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `failed_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_broadcasts_tenant` (`tenant_id`, `created_at`),
  CONSTRAINT `fk_broadcasts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `credit_analyses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `borrower_id` INT UNSIGNED DEFAULT NULL,
  `loan_id` INT UNSIGNED DEFAULT NULL,
  `file_name` VARCHAR(180) DEFAULT NULL,
  `file_type` VARCHAR(80) DEFAULT NULL,
  `file_data` MEDIUMBLOB,
  `summary` TEXT NOT NULL,
  `score_band` ENUM('unknown','excellent','good','fair','poor') NOT NULL DEFAULT 'unknown',
  `status` ENUM('uploaded','reviewed') NOT NULL DEFAULT 'uploaded',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_credit_tenant` (`tenant_id`, `created_at`),
  CONSTRAINT `fk_credit_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_credit_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `calculator_saves` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `client_id` INT UNSIGNED DEFAULT NULL,
  `loan_id` INT UNSIGNED DEFAULT NULL,
  `kind` VARCHAR(40) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `inputs_json` JSON NOT NULL,
  `result_json` JSON NOT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_calc_client` (`tenant_id`, `client_id`, `created_at`),
  CONSTRAINT `fk_calc_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_calc_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_templates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `detail` VARCHAR(500) NOT NULL DEFAULT '',
  `category` VARCHAR(40) NOT NULL DEFAULT 'document',
  `priority` VARCHAR(20) NOT NULL DEFAULT 'normal',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_templates_tenant` (`tenant_id`),
  CONSTRAINT `fk_task_templates_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `scheduler_settings` (
  `tenant_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Chicago',
  `slot_minutes` INT UNSIGNED NOT NULL DEFAULT 30,
  `buffer_minutes` INT UNSIGNED NOT NULL DEFAULT 15,
  `advance_days` INT UNSIGNED NOT NULL DEFAULT 21,
  `min_hours` INT UNSIGNED NOT NULL DEFAULT 2,
  `hours_json` VARCHAR(400) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`, `user_id`),
  CONSTRAINT `fk_scheduler_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `loan_drafts` (
  `user_id` INT UNSIGNED NOT NULL,
  `tenant_id` INT UNSIGNED NOT NULL,
  `step` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `payload_json` TEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `apply_drafts` (
  `token` VARCHAR(40) NOT NULL,
  `tenant_id` INT UNSIGNED NOT NULL,
  `officer_slug` VARCHAR(48) DEFAULT NULL,
  `step` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `payload_json` TEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`token`),
  KEY `idx_apply_drafts_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `description`)
SELECT 'app_version', '0.1.0', 'Current deployed application version'
WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `setting_key` = 'app_version');

INSERT INTO `legal_pages` (`code`, `body_md`)
SELECT 'terms', '# Terms\n\nMortgageProx provides a workspace for mortgage brokerages. MortgageProx is not a bank and does not approve loans.\n\n## The trial\n\nA start fee opens 30 days on Starter, Growth and Scale. If you continue, that fee is credited to the first invoice. A custom package is quoted and has no start fee.\n\n## Included amounts\n\nEach plan includes a set number of seats, open loans, emails, letters, text segments and calling minutes. Past that number, emails, letters and open loans can be extended with a pack. An extra seat is a monthly charge. Texts and calling minutes pause until the 1st. Twilio credits are billed by Twilio, not by MortgageProx.\n\n## Your account\n\nYou are responsible for the people you invite and for the messages the workspace sends.\n'
WHERE NOT EXISTS (SELECT 1 FROM `legal_pages` WHERE `code` = 'terms');

INSERT INTO `legal_pages` (`code`, `body_md`)
SELECT 'privacy', '# Privacy\n\nWe collect the account details you enter and the records you add so the workspace can run. We do not sell personal information.\n\n## What we store\n\nYour name, work email, phone and brokerage name. Card numbers are handled by Stripe and are not stored on MortgageProx servers.\n\n## How long\n\nWe keep the workspace data while the account is open, and as needed for invoices and security.\n'
WHERE NOT EXISTS (SELECT 1 FROM `legal_pages` WHERE `code` = 'privacy');

INSERT INTO `tenant_legal_pages` (`tenant_id`, `code`, `body_md`)
SELECT t.id, 'terms', CONCAT(
  '# Terms\n\nThese terms cover your use of ', t.name, '''s website, application and borrower portal.\n\n## Who you are working with\n\n',
  t.name, ' is a mortgage brokerage. ', t.name, ' is not a bank and does not approve, deny or fund loans. A lender makes those decisions.\n\n## Your information\n\nYou agree to give accurate information and to upload documents that are yours to share. ',
  t.name, ' uses that information to work on your loan file and to contact you about it.\n\n## Messages\n\nBy giving a phone number or email, you agree that ',
  t.name, ' may contact you about your loan, documents and appointments.\n\n## Your portal\n\nThe borrower portal is for you. Do not share your sign-in code. You can ask ',
  t.name, ' to close your access.\n'
)
FROM `tenants` t
WHERE NOT EXISTS (
  SELECT 1 FROM `tenant_legal_pages` p WHERE p.tenant_id = t.id AND p.code = 'terms'
);

INSERT INTO `tenant_legal_pages` (`tenant_id`, `code`, `body_md`)
SELECT t.id, 'privacy', CONCAT(
  '# Privacy policy\n\n', t.name, ' collects the contact details, loan information and documents you choose to share so the team can work on your file.\n\n## What is stored\n\nYour name, email, phone, loan details, messages and files you upload stay with ',
  t.name, '.\n\n## Who can see it\n\nPeople at ', t.name, ' who work on your file can see it. ',
  t.name, ' does not sell your personal information.\n\n## How long\n\n',
  t.name, ' keeps your file while your loan is open and for the period the brokerage must retain records. You can ask ',
  t.name, ' what they still hold.\n'
)
FROM `tenants` t
WHERE NOT EXISTS (
  SELECT 1 FROM `tenant_legal_pages` p WHERE p.tenant_id = t.id AND p.code = 'privacy'
);

INSERT IGNORE INTO `modules` (`code`, `name_key`, `summary_key`, `category`, `kind`, `sort_order`) VALUES
('website', 'modules.website.name', 'modules.website.summary', 'core', 'product', 10),
('application', 'modules.application.name', 'modules.application.summary', 'core', 'product', 20),
('pipeline', 'modules.pipeline.name', 'modules.pipeline.summary', 'core', 'product', 30),
('clients', 'modules.clients.name', 'modules.clients.summary', 'core', 'product', 40),
('groups', 'modules.groups.name', 'modules.groups.summary', 'core', 'product', 50),
('tasks', 'modules.tasks.name', 'modules.tasks.summary', 'growth', 'product', 60),
('documents', 'modules.documents.name', 'modules.documents.summary', 'core', 'product', 65),
('compliance', 'modules.compliance.name', 'modules.compliance.summary', 'core', 'product', 70),
('letters', 'modules.letters.name', 'modules.letters.summary', 'growth', 'product', 80),
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
('transcripts', 'modules.transcripts.name', 'modules.transcripts.summary', 'communications', 'product', 315),
('email', 'modules.email.name', 'modules.email.summary', 'communications', 'product', 320),
('broadcasts', 'modules.broadcasts.name', 'modules.broadcasts.summary', 'communications', 'product', 330),
('ai', 'modules.ai.name', 'modules.ai.summary', 'premium', 'product', 400),
('credit', 'modules.credit.name', 'modules.credit.summary', 'premium', 'product', 410),
('mcp', 'modules.mcp.name', 'modules.mcp.summary', 'premium', 'product', 420),
('campaigns', 'modules.campaigns.name', 'modules.campaigns.summary', 'premium', 'product', 430);

INSERT INTO `plans` (`code`, `name_key`, `tagline_key`, `price_cents`, `seat_limit`, `is_public`, `is_quote`, `trial_fee_cents`, `sort_order`)
SELECT 'starter', 'plans.starter.name', 'plans.starter.tagline', 14900, 3, 1, 0, 29900, 10
WHERE NOT EXISTS (SELECT 1 FROM `plans` WHERE `code` = 'starter');
INSERT INTO `plans` (`code`, `name_key`, `tagline_key`, `price_cents`, `seat_limit`, `is_public`, `is_quote`, `trial_fee_cents`, `sort_order`)
SELECT 'growth', 'plans.growth.name', 'plans.growth.tagline', 34900, 10, 1, 0, 29900, 20
WHERE NOT EXISTS (SELECT 1 FROM `plans` WHERE `code` = 'growth');
INSERT INTO `plans` (`code`, `name_key`, `tagline_key`, `price_cents`, `seat_limit`, `is_public`, `is_quote`, `trial_fee_cents`, `sort_order`)
SELECT 'scale', 'plans.scale.name', 'plans.scale.tagline', 69900, 25, 1, 0, 29900, 30
WHERE NOT EXISTS (SELECT 1 FROM `plans` WHERE `code` = 'scale');
INSERT INTO `plans` (`code`, `name_key`, `tagline_key`, `price_cents`, `seat_limit`, `is_public`, `is_quote`, `trial_fee_cents`, `sort_order`)
SELECT 'custom', 'plans.custom.name', 'plans.custom.tagline', 0, 0, 1, 1, 0, 40
WHERE NOT EXISTS (SELECT 1 FROM `plans` WHERE `code` = 'custom');

UPDATE `plans` SET included_loans = 40, included_emails = 500, included_letters = 0, included_sms = 0, included_voice_minutes = 0 WHERE code = 'starter';
UPDATE `plans` SET included_loans = 200, included_emails = 2500, included_letters = 40, included_sms = 0, included_voice_minutes = 0 WHERE code = 'growth';
UPDATE `plans` SET included_loans = NULL, included_emails = 10000, included_letters = 120, included_sms = 2000, included_voice_minutes = 1000, included_campaign_contacts = 800 WHERE code = 'scale';
UPDATE `plans` SET included_campaign_contacts = 800 WHERE code = 'custom';

CREATE TABLE IF NOT EXISTS `stripe_events` (
  `id` VARCHAR(80) NOT NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mcp_calls` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `tool_name` VARCHAR(40) NOT NULL,
  `invoiced` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mcp_calls_tenant` (`tenant_id`, `created_at`),
  KEY `idx_mcp_calls_uninvoiced` (`tenant_id`, `invoiced`, `id`),
  CONSTRAINT `fk_mcp_calls_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
('custom_styles', 'addons.customStyles.name', 'addons.customStyles.summary', 0, 'once', 10),
('twilio', 'addons.twilio.name', 'addons.twilio.summary', 9900, 'monthly', 20),
('custom_domain', 'addons.customDomain.name', 'addons.customDomain.summary', 1900, 'monthly', 30),
('extra_seat', 'addons.extraSeat.name', 'addons.extraSeat.summary', 2900, 'monthly', 40),
('campaign_pack', 'addons.campaignPack.name', 'addons.campaignPack.summary', 900, 'monthly', 50);

INSERT INTO `usage_packs` (`code`, `meter`, `units`, `price_cents`, `name_key`, `summary_key`)
SELECT 'emails_500', 'emails', 500, 1500, 'billing.pack.emails', 'billing.pack.emailsSummary'
WHERE NOT EXISTS (SELECT 1 FROM `usage_packs` WHERE `code` = 'emails_500');
INSERT INTO `usage_packs` (`code`, `meter`, `units`, `price_cents`, `name_key`, `summary_key`)
SELECT 'letters_20', 'letters', 20, 2500, 'billing.pack.letters', 'billing.pack.lettersSummary'
WHERE NOT EXISTS (SELECT 1 FROM `usage_packs` WHERE `code` = 'letters_20');
INSERT INTO `usage_packs` (`code`, `meter`, `units`, `price_cents`, `name_key`, `summary_key`)
SELECT 'loans_20', 'loans', 20, 4900, 'billing.pack.loans', 'billing.pack.loansSummary'
WHERE NOT EXISTS (SELECT 1 FROM `usage_packs` WHERE `code` = 'loans_20');

CREATE TABLE IF NOT EXISTS `platform_settings` (
  `setting_key` VARCHAR(64) NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `platform_settings` (`setting_key`, `setting_value`)
SELECT 'campaign_contact_ceiling', '1000'
WHERE NOT EXISTS (SELECT 1 FROM `platform_settings` WHERE `setting_key` = 'campaign_contact_ceiling');

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

INSERT INTO `platform_users` (`email`, `first_name`, `last_name`, `role`, `status`)
SELECT 'alex@disruptinglabs.com', 'Alex', 'Gomez', 'platform_owner', 'active'
WHERE NOT EXISTS (SELECT 1 FROM `platform_users` WHERE `email` = 'alex@disruptinglabs.com');
