CREATE TABLE IF NOT EXISTS `legal_pages` (
  `code` VARCHAR(20) NOT NULL,
  `body_md` MEDIUMTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `legal_pages` (`code`, `body_md`)
SELECT 'terms', '# Terms\n\nMortgageProx provides a workspace for mortgage brokerages. MortgageProx is not a bank and does not approve loans.\n\n## The trial\n\nA start fee opens 30 days on Starter, Growth and Scale. If you continue, that fee is credited to the first invoice. A custom package is quoted and has no start fee.\n\n## Included amounts\n\nEach plan includes a set number of seats, open loans, emails, letters, text segments and calling minutes. Past that number, emails, letters and open loans can be extended with a pack. An extra seat is a monthly charge. Texts and calling minutes pause until the 1st. Twilio credits are billed by Twilio, not by MortgageProx.\n\n## Your account\n\nYou are responsible for the people you invite and for the messages the workspace sends.\n'
WHERE NOT EXISTS (SELECT 1 FROM `legal_pages` WHERE `code` = 'terms');

INSERT INTO `legal_pages` (`code`, `body_md`)
SELECT 'privacy', '# Privacy\n\nWe collect the account details you enter and the records you add so the workspace can run. We do not sell personal information.\n\n## What we store\n\nYour name, work email, phone and brokerage name. Card numbers are handled by Stripe and are not stored on MortgageProx servers.\n\n## How long\n\nWe keep the workspace data while the account is open, and as needed for invoices and security.\n'
WHERE NOT EXISTS (SELECT 1 FROM `legal_pages` WHERE `code` = 'privacy');
