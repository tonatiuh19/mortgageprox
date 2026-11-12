ALTER TABLE plans ADD COLUMN trial_fee_cents INT UNSIGNED NOT NULL DEFAULT 0;
UPDATE plans SET trial_fee_cents = 29900 WHERE code IN ('starter', 'growth', 'scale');
UPDATE addons SET price_cents = 0 WHERE code = 'custom_styles';
ALTER TABLE tenant_subscriptions ADD COLUMN start_fee_cents INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE tenant_subscriptions ADD COLUMN start_fee_status VARCHAR(12) NOT NULL DEFAULT 'none';
