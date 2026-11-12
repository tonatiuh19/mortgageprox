ALTER TABLE plans ADD COLUMN included_loans INT UNSIGNED NULL DEFAULT NULL;
ALTER TABLE plans ADD COLUMN included_emails INT UNSIGNED NULL DEFAULT NULL;
ALTER TABLE plans ADD COLUMN included_letters INT UNSIGNED NULL DEFAULT NULL;
ALTER TABLE plans ADD COLUMN included_sms INT UNSIGNED NULL DEFAULT NULL;
ALTER TABLE plans ADD COLUMN included_voice_minutes INT UNSIGNED NULL DEFAULT NULL;
ALTER TABLE plans ADD COLUMN stripe_price_id VARCHAR(80) DEFAULT NULL;

UPDATE plans
   SET included_loans = 40, included_emails = 500, included_letters = 0, included_sms = 0, included_voice_minutes = 0
 WHERE code = 'starter';
UPDATE plans
   SET included_loans = 200, included_emails = 2500, included_letters = 40, included_sms = 500, included_voice_minutes = 200
 WHERE code = 'growth';
UPDATE plans
   SET included_loans = NULL, included_emails = 10000, included_letters = 120, included_sms = 2000, included_voice_minutes = 1000
 WHERE code = 'scale';

ALTER TABLE tenant_subscriptions ADD COLUMN stripe_customer_id VARCHAR(80) DEFAULT NULL;
ALTER TABLE tenant_subscriptions ADD COLUMN stripe_subscription_id VARCHAR(80) DEFAULT NULL;
ALTER TABLE tenant_subscriptions ADD COLUMN stripe_checkout_session_id VARCHAR(80) DEFAULT NULL;
ALTER TABLE tenant_subscriptions ADD COLUMN start_fee_credit_cents INT UNSIGNED NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS stripe_events (
  id VARCHAR(80) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
