-- Per-tenant office menu, contacts, inbox, loan file, templates, credit and saved calculators.

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
  `channel` ENUM('sms','whatsapp','email','call','note') NOT NULL DEFAULT 'note',
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
  `channel` ENUM('sms','whatsapp','email','call','note') NOT NULL,
  `body` TEXT NOT NULL,
  `status` ENUM('received','queued','sent','failed') NOT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messages_thread` (`thread_id`, `id`),
  CONSTRAINT `fk_messages_thread` FOREIGN KEY (`thread_id`) REFERENCES `conversation_threads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `loan_documents` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `loan_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `status` ENUM('needed','received','reviewed','waived') NOT NULL DEFAULT 'needed',
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
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_templates_tenant` (`tenant_id`, `name`),
  CONSTRAINT `fk_templates_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reminder_flows` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `trigger_kind` ENUM('stage_enter','manual') NOT NULL DEFAULT 'stage_enter',
  `stage_id` INT UNSIGNED DEFAULT NULL,
  `channel` ENUM('sms','email') NOT NULL DEFAULT 'email',
  `delay_hours` INT UNSIGNED NOT NULL DEFAULT 0,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_flows_tenant` (`tenant_id`),
  CONSTRAINT `fk_flows_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_flows_stage` FOREIGN KEY (`stage_id`) REFERENCES `pipeline_stages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `broadcasts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `channel` ENUM('sms','email') NOT NULL,
  `audience` ENUM('clients','contacts','realtors') NOT NULL,
  `body` TEXT NOT NULL,
  `status` ENUM('draft','queued') NOT NULL DEFAULT 'queued',
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
