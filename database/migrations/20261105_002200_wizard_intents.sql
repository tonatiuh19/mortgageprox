CREATE TABLE IF NOT EXISTS wizard_intents (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  payload_json JSON NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  amount_cents INT UNSIGNED NOT NULL,
  stripe_customer_id VARCHAR(80) DEFAULT NULL,
  stripe_checkout_session_id VARCHAR(80) DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  tenant_id INT UNSIGNED DEFAULT NULL,
  email_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wizard_intent_session (stripe_checkout_session_id),
  KEY idx_wizard_intents_email (email, payload_hash, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
