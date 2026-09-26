/*
  # Pin privileged invoice columns against customer writes

  1. Problem
    - The "Customers can update own invoices" policy is a row-level rule, so a
      customer who can update their invoice row can update EVERY column of it,
      including `invoice_status`, `total_amount`, `subtotal`, `tax_amount`,
      the discount amounts and the payment/CFDI bookkeeping fields.

  2. Changes
    - Add `enforce_invoices_privileged_columns()` and a BEFORE INSERT/UPDATE
      trigger that restores those columns to their previous values for
      non-staff sessions, mirroring the existing orders trigger.

  3. Security
    - Service role connections (edge functions, webhooks, migrations) and staff
      sessions keep full control, so admin tooling and invoicing jobs are
      unaffected.
*/

CREATE OR REPLACE FUNCTION public.enforce_invoices_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin', 'authenticator', 'supabase_storage_admin') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR public.is_staff_user() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.invoice_status := 'pending';
    NEW.payment_date := NULL;
    NEW.paypal_invoice_id := NULL;
    NEW.paypal_status := NULL;
    NEW.paypal_invoice_status := NULL;
    NEW.paypal_payment_received_at := NULL;
    NEW.facturama_cfdi_id := NULL;
    NEW.facturama_cfdi_uuid := NULL;
    NEW.facturama_cfdi_status := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: keep every privileged value as it was.
  NEW.invoice_id := OLD.invoice_id;
  NEW.order_id := OLD.order_id;
  NEW.invoice_number := OLD.invoice_number;
  NEW.invoice_status := OLD.invoice_status;
  NEW.subtotal := OLD.subtotal;
  NEW.tax_amount := OLD.tax_amount;
  NEW.total_amount := OLD.total_amount;
  NEW.delivery_option_price := OLD.delivery_option_price;
  NEW.delivery_tax_amount := OLD.delivery_tax_amount;
  NEW.custom_discount_amount := OLD.custom_discount_amount;
  NEW.plan_discount_amount := OLD.plan_discount_amount;
  NEW.coupon_discount_amount := OLD.coupon_discount_amount;
  NEW.payment_date := OLD.payment_date;
  NEW.bank_account_id := OLD.bank_account_id;
  NEW.invoice_group_id := OLD.invoice_group_id;
  NEW.paypal_invoice_id := OLD.paypal_invoice_id;
  NEW.paypal_invoice_href := OLD.paypal_invoice_href;
  NEW.paypal_status := OLD.paypal_status;
  NEW.paypal_sent_at := OLD.paypal_sent_at;
  NEW.paypal_last_synced := OLD.paypal_last_synced;
  NEW.paypal_recipient_view_url := OLD.paypal_recipient_view_url;
  NEW.paypal_payment_received_at := OLD.paypal_payment_received_at;
  NEW.paypal_invoice_status := OLD.paypal_invoice_status;
  NEW.paypal_invoice_number := OLD.paypal_invoice_number;
  NEW.facturama_cfdi_id := OLD.facturama_cfdi_id;
  NEW.facturama_cfdi_uuid := OLD.facturama_cfdi_uuid;
  NEW.facturama_cfdi_status := OLD.facturama_cfdi_status;
  NEW.facturama_cfdi_pdf_url := OLD.facturama_cfdi_pdf_url;
  NEW.facturama_cfdi_xml_url := OLD.facturama_cfdi_xml_url;
  NEW.facturama_cfdi_created_at := OLD.facturama_cfdi_created_at;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_invoices_privileged_columns ON public.invoices;

CREATE TRIGGER trg_invoices_privileged_columns
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoices_privileged_columns();
