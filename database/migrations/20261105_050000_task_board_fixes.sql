-- Documents stay on every plan. Unsent task reminders stop when the board is off.
INSERT INTO `modules` (`code`, `name_key`, `summary_key`, `category`, `kind`, `sort_order`)
SELECT 'documents', 'modules.documents.name', 'modules.documents.summary', 'core', 'product', 65
WHERE NOT EXISTS (SELECT 1 FROM `modules` WHERE `code` = 'documents');

INSERT INTO `plan_modules` (`plan_id`, `module_code`)
SELECT p.id, 'documents' FROM `plans` p
WHERE NOT EXISTS (
  SELECT 1 FROM `plan_modules` existing WHERE existing.plan_id = p.id AND existing.module_code = 'documents'
);

INSERT INTO `tenant_modules` (`tenant_id`, `module_code`, `enabled`)
SELECT t.id, 'documents', 1 FROM `tenants` t
WHERE NOT EXISTS (
  SELECT 1 FROM `tenant_modules` existing WHERE existing.tenant_id = t.id AND existing.module_code = 'documents'
);

UPDATE `tenant_sections` SET `module_code` = 'documents' WHERE `section_id` = 'documents';

DELETE r FROM `task_reminders` r
INNER JOIN `tasks` t ON t.id = r.task_id
LEFT JOIN `tenant_modules` m ON m.tenant_id = t.tenant_id AND m.module_code = 'tasks' AND m.enabled = 1
WHERE r.sent_at IS NULL AND m.tenant_id IS NULL;
