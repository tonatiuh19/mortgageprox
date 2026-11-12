-- Read-only MCP connector. Scale and Custom include the module.
-- Each successful tool call is usage at 3 cents, recorded here and invoiced when a Stripe customer exists.

ALTER TABLE `tenants`
  ADD COLUMN `mcp_token_hash` CHAR(64) DEFAULT NULL,
  ADD COLUMN `mcp_token_prefix` VARCHAR(12) DEFAULT NULL;

ALTER TABLE `tenants`
  ADD UNIQUE KEY `uq_tenants_mcp_token` (`mcp_token_hash`);

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

INSERT INTO `modules` (`code`, `name_key`, `summary_key`, `category`, `kind`, `sort_order`)
SELECT 'mcp', 'modules.mcp.name', 'modules.mcp.summary', 'premium', 'product', 420
WHERE NOT EXISTS (SELECT 1 FROM `modules` WHERE `code` = 'mcp');

INSERT INTO `plan_modules` (`plan_id`, `module_code`)
SELECT p.id, 'mcp' FROM `plans` p
WHERE p.code IN ('scale', 'custom')
AND NOT EXISTS (
  SELECT 1 FROM `plan_modules` existing WHERE existing.plan_id = p.id AND existing.module_code = 'mcp'
);
