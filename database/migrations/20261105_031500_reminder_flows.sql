ALTER TABLE `reminder_flows`
  ADD COLUMN `description` VARCHAR(400) DEFAULT NULL AFTER `name`,
  ADD COLUMN `stop_on_reply` TINYINT(1) NOT NULL DEFAULT 1 AFTER `enabled`,
  ADD COLUMN `quiet_start_hour` TINYINT UNSIGNED NOT NULL DEFAULT 9 AFTER `stop_on_reply`,
  ADD COLUMN `quiet_end_hour` TINYINT UNSIGNED NOT NULL DEFAULT 19 AFTER `quiet_start_hour`;

ALTER TABLE `reminder_flows` MODIFY COLUMN `enabled` TINYINT(1) NOT NULL DEFAULT 0;

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
