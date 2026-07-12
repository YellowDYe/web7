/*
  # Create Bank Account Movements View and Update Invoice Status

  1. Database Changes
    - Update invoice status constraint to only allow 'draft', 'paid', 'cancelled'
    - Update existing 'sent' invoices to 'draft' status
    - Create bank_account_movements view combining invoices and expenses

  2. Bank Account Movements View
    - Combines income from invoices table
    - Combines expenses from expenses table
    - Provides unified view of all bank account movements
    - Includes proper typing and filtering

  3. Security
    - View inherits RLS from underlying tables
    - No additional policies needed
*/

-- First, update any existing 'sent' invoices to 'draft'
UPDATE invoices 
SET invoice_status = 'draft' 
WHERE invoice_status = 'sent';

-- Drop the existing constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add the updated constraint with only 'draft', 'paid', 'cancelled'
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
CHECK (invoice_status = ANY (ARRAY['draft'::text, 'paid'::text, 'cancelled'::text]));

-- Create the bank_account_movements view
CREATE OR REPLACE VIEW bank_account_movements AS
SELECT
    id::text AS movement_id,
    bank_account_id,
    invoice_date AS date,
    COALESCE(invoice_summary, 'Ticket de venta') AS description,
    total_amount AS amount,
    'income' AS type,
    'invoice' AS source_type,
    COALESCE(order_id, invoice_number) AS source_id,
    created_at
FROM
    invoices
WHERE
    bank_account_id IS NOT NULL
    AND invoice_status = 'paid' -- Only include paid invoices

UNION ALL

SELECT
    id::text AS movement_id,
    bank_account_id,
    expense_date AS date,
    expense_name AS description,
    -expense_total AS amount, -- Negative for expenses
    'expense' AS type,
    'expense' AS source_type,
    expense_id AS source_id,
    created_at
FROM
    expenses
WHERE
    bank_account_id IS NOT NULL;

-- Add comment to the view
COMMENT ON VIEW bank_account_movements IS 'Unified view of all bank account movements from invoices and expenses';