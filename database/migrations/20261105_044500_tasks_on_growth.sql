-- The task board is chosen with Growth and above, not included in Starter.
UPDATE `modules` SET `category` = 'growth' WHERE `code` = 'tasks';

DELETE pm FROM `plan_modules` pm
INNER JOIN `plans` p ON p.id = pm.plan_id
WHERE p.code = 'starter' AND pm.module_code = 'tasks';

INSERT INTO `plan_modules` (`plan_id`, `module_code`)
SELECT p.id, 'tasks' FROM `plans` p
WHERE p.code IN ('growth', 'scale', 'custom')
AND NOT EXISTS (
  SELECT 1 FROM `plan_modules` existing WHERE existing.plan_id = p.id AND existing.module_code = 'tasks'
);

UPDATE `tenant_modules` tm
INNER JOIN `tenants` t ON t.id = tm.tenant_id
INNER JOIN `plans` p ON p.id = t.plan_id
SET tm.enabled = 0
WHERE tm.module_code = 'tasks' AND p.code = 'starter';
