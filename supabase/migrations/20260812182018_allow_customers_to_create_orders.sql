/*
# Allow customers to create orders, order weeks, and invoices

1. Problem
   - Customers (authenticated users linked via `customers.auth_user_id`) were unable
     to place orders because INSERT policies on `orders`, `order_weeks`, and `invoices`
     only allowed admin/staff roles.
   - This caused "Error al crear el pedido" on the customer checkout.

2. Security Changes (RLS Policies)
   - `orders`: Add INSERT policy for customers to create orders where the `customer_id`
     matches their linked customer record.
   - `orders`: Add UPDATE policy for customers to update their own orders (e.g. payment status).
   - `order_weeks`: Add INSERT policy for customers to create order weeks for orders they own.
   - `invoices`: Add INSERT policy for customers to create invoices for their own orders.
   - `invoices`: Add UPDATE policy for customers to update invoices on their own orders.

3. Important Notes
   - All policies verify ownership through the `customers.auth_user_id = auth.uid()` chain.
   - Customers can only INSERT/UPDATE their own orders -- never other customers' data.
   - Existing admin/staff policies remain unchanged.
*/

-- Customers can insert their own orders
DROP POLICY IF EXISTS "Customers can insert own orders" ON orders;
CREATE POLICY "Customers can insert own orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customers
    WHERE customers.customer_id = orders.customer_id
      AND customers.auth_user_id = (SELECT auth.uid())
  )
);

-- Customers can update their own orders (payment status, etc.)
DROP POLICY IF EXISTS "Customers can update own orders" ON orders;
CREATE POLICY "Customers can update own orders"
ON orders FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customers
    WHERE customers.customer_id = orders.customer_id
      AND customers.auth_user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customers
    WHERE customers.customer_id = orders.customer_id
      AND customers.auth_user_id = (SELECT auth.uid())
  )
);

-- Customers can insert order weeks for their own orders
DROP POLICY IF EXISTS "Customers can insert own order weeks" ON order_weeks;
CREATE POLICY "Customers can insert own order weeks"
ON order_weeks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    JOIN customers ON customers.customer_id = orders.customer_id
    WHERE orders.order_id = order_weeks.order_id
      AND customers.auth_user_id = (SELECT auth.uid())
  )
);

-- Customers can insert invoices for their own orders
DROP POLICY IF EXISTS "Customers can insert own invoices" ON invoices;
CREATE POLICY "Customers can insert own invoices"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    JOIN customers ON customers.customer_id = orders.customer_id
    WHERE orders.order_id = invoices.order_id
      AND customers.auth_user_id = (SELECT auth.uid())
  )
);

-- Customers can update invoices on their own orders (e.g. mark as paid)
DROP POLICY IF EXISTS "Customers can update own invoices" ON invoices;
CREATE POLICY "Customers can update own invoices"
ON invoices FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    JOIN customers ON customers.customer_id = orders.customer_id
    WHERE orders.order_id = invoices.order_id
      AND customers.auth_user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    JOIN customers ON customers.customer_id = orders.customer_id
    WHERE orders.order_id = invoices.order_id
      AND customers.auth_user_id = (SELECT auth.uid())
  )
);
