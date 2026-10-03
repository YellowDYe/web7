/*
# Store customer phone and country code separately

1. Changes
- New trigger function `normalize_customer_phone()` on `customers` (BEFORE INSERT/UPDATE of customer_phone).
  When customer_phone arrives as "+<code> <number>" (e.g. "+52 5512345678", as sent by website signup),
  the "+<code>" part is moved into `country_code` and only the digits stay in `customer_phone`.
  Values already stored as plain digits are not touched.
2. Data cleanup
- Existing rows stored as "+<code> <digits>" are split the same way.
- Rows stored as "+52" immediately followed by 10 digits (no space) are split into +52 / 10 digits.
- Rows with an empty or missing country_code get "+52".
- Numbers in other formats (e.g. US numbers, malformed test data) are left unchanged.
3. Security
- No RLS or privilege changes.
*/

CREATE OR REPLACE FUNCTION public.normalize_customer_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  m text[];
BEGIN
  IF NEW.customer_phone IS NOT NULL THEN
    m := regexp_match(btrim(NEW.customer_phone), '^(\+\d{1,3})\s+([\d\s-]+)$');
    IF m IS NOT NULL THEN
      NEW.country_code := m[1];
      NEW.customer_phone := regexp_replace(m[2], '\D', '', 'g');
    END IF;
  END IF;
  IF NEW.country_code IS NULL OR btrim(NEW.country_code) = '' THEN
    NEW.country_code := '+52';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_customer_phone_trg ON public.customers;
CREATE TRIGGER normalize_customer_phone_trg
BEFORE INSERT OR UPDATE OF customer_phone, country_code ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.normalize_customer_phone();

UPDATE public.customers
SET country_code = (regexp_match(btrim(customer_phone), '^(\+\d{1,3})\s+'))[1],
    customer_phone = regexp_replace(regexp_replace(btrim(customer_phone), '^\+\d{1,3}\s+', ''), '\D', '', 'g')
WHERE btrim(customer_phone) ~ '^\+\d{1,3}\s+[\d\s-]+$';

UPDATE public.customers
SET country_code = '+52', customer_phone = substring(btrim(customer_phone) from 4)
WHERE btrim(customer_phone) ~ '^\+52\d{10}$';

UPDATE public.customers
SET country_code = '+52'
WHERE country_code IS NULL OR btrim(country_code) = '';
