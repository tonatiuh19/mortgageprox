ALTER TABLE `broadcasts`
  MODIFY COLUMN `status` ENUM('draft','queued','sent','partial','failed') NOT NULL DEFAULT 'queued';

ALTER TABLE `broadcasts`
  ADD COLUMN IF NOT EXISTS `sent_count` INT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE `broadcasts`
  ADD COLUMN IF NOT EXISTS `failed_count` INT UNSIGNED NOT NULL DEFAULT 0;
