/*
# Seed notification_settings in cms_settings

1. Changes
   - Inserts a new row into `cms_settings` with setting_name = 'notification_settings'
   - Default value: enabled = false, emails = [] (empty array)
   - Uses ON CONFLICT to be idempotent

2. Purpose
   - Stores admin email addresses for order notification emails
   - Configurable via the Website Settings UI
*/

INSERT INTO cms_settings (setting_name, value)
VALUES (
  'notification_settings',
  '{"enabled": false, "emails": [], "notify_on_approved": true, "notify_on_pending": true, "notify_on_failed": true}'::jsonb
)
ON CONFLICT (setting_name) DO NOTHING;
