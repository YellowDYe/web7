/*
# Add SEO columns to cms_pages

1. Changes
- Adds `meta_title` (text, nullable) to `cms_pages` — optional custom SEO title per page.
- Adds `meta_description` (text, nullable) to `cms_pages` — optional custom SEO meta description per page.
2. Security
- No RLS policy changes. Existing policies on `cms_pages` remain unchanged.
  These columns are readable by the same roles that already read the table.
3. Notes
- Both columns are nullable so existing pages are unaffected.
- The admin Page Manager editor now includes fields for these values.
- The customer-facing site reads them to set per-page <title> and meta description tags.
*/

ALTER TABLE cms_pages
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text;
