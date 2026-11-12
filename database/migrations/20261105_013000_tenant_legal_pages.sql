CREATE TABLE IF NOT EXISTS `tenant_legal_pages` (
  `tenant_id` INT UNSIGNED NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `body_md` MEDIUMTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`, `code`),
  CONSTRAINT `fk_tenant_legal_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
