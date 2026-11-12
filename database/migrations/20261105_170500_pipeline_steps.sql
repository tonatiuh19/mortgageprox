-- The loan path runs from draft through funding. Offices still on the original six names move forward. A custom path is left alone.

ALTER TABLE `pipeline_stages` ADD COLUMN IF NOT EXISTS `code` VARCHAR(40) DEFAULT NULL;

UPDATE `pipeline_stages` s
JOIN (
  SELECT tenant_id
    FROM pipeline_stages
   GROUP BY tenant_id
  HAVING COUNT(*) = 6
     AND SUM(name = 'New lead') = 1
     AND SUM(name = 'Application') = 1
     AND SUM(name = 'Processing') = 1
     AND SUM(name = 'Underwriting') = 1
     AND SUM(name = 'Clear to close') = 1
     AND SUM(name = 'Funded') = 1
) original ON original.tenant_id = s.tenant_id
SET
  s.sort_order = CASE s.name
    WHEN 'New lead' THEN 10
    WHEN 'Application' THEN 30
    WHEN 'Processing' THEN 50
    WHEN 'Underwriting' THEN 60
    WHEN 'Clear to close' THEN 80
    WHEN 'Funded' THEN 100
    ELSE s.sort_order
  END,
  s.is_funded = CASE WHEN s.name = 'Funded' THEN 1 ELSE s.is_funded END,
  s.code = CASE s.name
    WHEN 'New lead' THEN 'draft'
    WHEN 'Application' THEN 'application_received'
    WHEN 'Processing' THEN 'under_contract'
    WHEN 'Underwriting' THEN 'submitted_uw'
    WHEN 'Clear to close' THEN 'clear_to_close'
    WHEN 'Funded' THEN 'funded'
    ELSE s.code
  END;

UPDATE `pipeline_stages`
   SET name = CASE code
     WHEN 'draft' THEN 'Draft'
     WHEN 'application_received' THEN 'Application Received'
     WHEN 'under_contract' THEN 'Under Contract / Loan Setup'
     WHEN 'submitted_uw' THEN 'Submitted to Underwriting'
     WHEN 'clear_to_close' THEN 'Clear to Close'
     WHEN 'funded' THEN 'Loan Funded'
     ELSE name
   END
 WHERE code IN ('draft', 'application_received', 'under_contract', 'submitted_uw', 'clear_to_close', 'funded')
   AND name IN ('New lead', 'Application', 'Processing', 'Underwriting', 'Clear to close', 'Funded');

INSERT INTO `pipeline_stages` (`tenant_id`, `name`, `sort_order`, `is_funded`, `code`)
SELECT t.tenant_id, v.name, v.sort_order, v.is_funded, v.code
  FROM (SELECT DISTINCT tenant_id FROM pipeline_stages WHERE code = 'draft') t
  JOIN (
    SELECT _utf8mb4'App Sent' COLLATE utf8mb4_unicode_ci AS name, 20 AS sort_order, 0 AS is_funded, _utf8mb4'app_sent' COLLATE utf8mb4_unicode_ci AS code
    UNION ALL SELECT _utf8mb4'Pre-Approved' COLLATE utf8mb4_unicode_ci, 40, 0, _utf8mb4'pre_approved' COLLATE utf8mb4_unicode_ci
    UNION ALL SELECT _utf8mb4'Approved with Conditions' COLLATE utf8mb4_unicode_ci, 70, 0, _utf8mb4'approved_conditions' COLLATE utf8mb4_unicode_ci
    UNION ALL SELECT _utf8mb4'Docs Out' COLLATE utf8mb4_unicode_ci, 90, 0, _utf8mb4'docs_out' COLLATE utf8mb4_unicode_ci
  ) v
 WHERE NOT EXISTS (
   SELECT 1 FROM pipeline_stages p WHERE p.tenant_id = t.tenant_id AND p.code = v.code
 );
