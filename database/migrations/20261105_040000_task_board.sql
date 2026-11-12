ALTER TABLE `tasks` ADD COLUMN `assigned_user_id` INT UNSIGNED DEFAULT NULL;
ALTER TABLE `tasks` ADD COLUMN `column_key` ENUM('todo','doing','waiting','done') NOT NULL DEFAULT 'todo';
ALTER TABLE `tasks` ADD COLUMN `priority` ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal';
ALTER TABLE `tasks` ADD COLUMN `due_at` DATETIME DEFAULT NULL;
ALTER TABLE `tasks` ADD COLUMN `position` INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE `tasks` ADD KEY `idx_tasks_board` (`tenant_id`, `column_key`, `position`);
ALTER TABLE `tasks` ADD CONSTRAINT `fk_tasks_assignee` FOREIGN KEY (`assigned_user_id`) REFERENCES `tenant_users` (`id`) ON DELETE SET NULL;
UPDATE `tasks` SET `column_key` = 'done' WHERE `status` = 'done';

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
