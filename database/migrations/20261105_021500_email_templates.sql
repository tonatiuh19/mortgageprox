-- Designed email copy. The layout stays in code. These rows are the words.

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

ALTER TABLE `message_templates`
  ADD COLUMN `greeting` VARCHAR(160) DEFAULT NULL,
  ADD COLUMN `headline` VARCHAR(200) DEFAULT NULL,
  ADD COLUMN `button_label` VARCHAR(80) DEFAULT NULL,
  ADD COLUMN `button_url` VARCHAR(500) DEFAULT NULL,
  ADD COLUMN `details_json` JSON DEFAULT NULL,
  ADD COLUMN `footer` VARCHAR(240) DEFAULT NULL;

INSERT INTO `message_templates` (`tenant_id`, `name`, `channel`, `subject`, `body`, `greeting`, `headline`, `button_label`, `button_url`, `details_json`, `footer`)
SELECT t.id, 'Welcome', 'email', 'Welcome to {{brokerage}}',
  '{{brokerage}} is ready to walk with you. Reply to this email when you want the next step.',
  'Hello {{firstName}},', 'Welcome. Your file has a home.', 'Open your portal', '{{portalUrl}}',
  JSON_ARRAY(),
  '{{brokerage}} is a mortgage brokerage. {{brokerage}} is not a bank and does not approve loans.'
FROM `tenants` t
WHERE NOT EXISTS (SELECT 1 FROM `message_templates` m WHERE m.tenant_id = t.id AND m.name = 'Welcome');

INSERT INTO `message_templates` (`tenant_id`, `name`, `channel`, `subject`, `body`, `greeting`, `headline`, `button_label`, `button_url`, `details_json`, `footer`)
SELECT t.id, 'Document request', 'email', 'Documents for your loan',
  'When you have a moment, send a photo ID and the last two pay stubs. {{officer}} is on the file.',
  'Hello {{firstName}},', 'Two documents will move this forward.', 'Upload documents', '{{portalUrl}}',
  JSON_ARRAY(JSON_OBJECT('label', 'Needed', 'value', 'Photo ID'), JSON_OBJECT('label', 'Needed', 'value', 'Last two pay stubs')),
  '{{brokerage}} is a mortgage brokerage. {{brokerage}} is not a bank and does not approve loans.'
FROM `tenants` t
WHERE NOT EXISTS (SELECT 1 FROM `message_templates` m WHERE m.tenant_id = t.id AND m.name = 'Document request');

INSERT INTO `message_templates` (`tenant_id`, `name`, `channel`, `subject`, `body`, `greeting`, `headline`, `button_label`, `button_url`, `details_json`, `footer`)
SELECT t.id, 'Task assigned', 'email', 'A task is yours',
  '{{task}}',
  'Hello {{firstName}},', 'A task is waiting.', 'Open your tasks', '{{appUrl}}',
  JSON_ARRAY(JSON_OBJECT('label', 'From', 'value', '{{brokerage}}')),
  'You are receiving this because you have an account with {{brokerage}}.'
FROM `tenants` t
WHERE NOT EXISTS (SELECT 1 FROM `message_templates` m WHERE m.tenant_id = t.id AND m.name = 'Task assigned');

INSERT INTO `message_templates` (`tenant_id`, `name`, `channel`, `subject`, `body`, `greeting`, `headline`, `button_label`, `button_url`, `details_json`, `footer`)
SELECT t.id, 'Payment receipt', 'email', 'Payment received',
  '{{brokerage}} recorded this payment on your file.',
  'Hello {{firstName}},', 'We received your payment.', 'View your file', '{{portalUrl}}',
  JSON_ARRAY(JSON_OBJECT('label', 'Amount', 'value', '{{amount}}'), JSON_OBJECT('label', 'Date', 'value', '{{date}}'), JSON_OBJECT('label', 'Reference', 'value', '{{reference}}')),
  '{{brokerage}} is a mortgage brokerage. {{brokerage}} is not a bank and does not approve loans.'
FROM `tenants` t
WHERE NOT EXISTS (SELECT 1 FROM `message_templates` m WHERE m.tenant_id = t.id AND m.name = 'Payment receipt');
