/*
  # Security: replace `USING (true)` reads with owner/staff predicates

  Storefront customers share the `authenticated` role with staff, so a `true`
  predicate published these tables to every registered shopper.

  - cfdis: readable by the customer it belongs to, or by staff.
  - incomes, customer_associations, crm_* , manychat_* operational tables:
    staff only.
  - blog_posts: writes restricted to staff (public read of published posts is
    unchanged).
  - protein_orders: the anonymous INSERT policy is removed.
*/

-- cfdis -------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can select cfdis" ON public.cfdis;

CREATE POLICY "owner_or_staff_select_cfdis" ON public.cfdis
  FOR SELECT TO authenticated
  USING (
    public.is_staff_user()
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.customer_id = cfdis.customer_id
        AND c.auth_user_id = auth.uid()
    )
  );

-- incomes -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read all incomes" ON public.incomes;

CREATE POLICY "staff_select_incomes" ON public.incomes
  FOR SELECT TO authenticated USING (public.is_staff_user());

-- customer_associations ---------------------------------------------------
DROP POLICY IF EXISTS "select_customer_associations" ON public.customer_associations;
DROP POLICY IF EXISTS "insert_customer_associations" ON public.customer_associations;
DROP POLICY IF EXISTS "update_customer_associations" ON public.customer_associations;
DROP POLICY IF EXISTS "delete_customer_associations" ON public.customer_associations;

CREATE POLICY "staff_select_customer_associations" ON public.customer_associations
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_customer_associations" ON public.customer_associations
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_customer_associations" ON public.customer_associations
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_customer_associations" ON public.customer_associations
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- crm_campaign_recipients -------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_crm_recipients" ON public.crm_campaign_recipients;
DROP POLICY IF EXISTS "authenticated_insert_crm_recipients" ON public.crm_campaign_recipients;
DROP POLICY IF EXISTS "authenticated_update_crm_recipients" ON public.crm_campaign_recipients;
DROP POLICY IF EXISTS "authenticated_delete_crm_recipients" ON public.crm_campaign_recipients;

CREATE POLICY "staff_select_crm_recipients" ON public.crm_campaign_recipients
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_crm_recipients" ON public.crm_campaign_recipients
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_crm_recipients" ON public.crm_campaign_recipients
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_crm_recipients" ON public.crm_campaign_recipients
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- crm_campaigns -----------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_crm_campaigns" ON public.crm_campaigns;
DROP POLICY IF EXISTS "authenticated_insert_crm_campaigns" ON public.crm_campaigns;
DROP POLICY IF EXISTS "authenticated_update_crm_campaigns" ON public.crm_campaigns;
DROP POLICY IF EXISTS "authenticated_delete_crm_campaigns" ON public.crm_campaigns;

CREATE POLICY "staff_select_crm_campaigns" ON public.crm_campaigns
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_crm_campaigns" ON public.crm_campaigns
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_crm_campaigns" ON public.crm_campaigns
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_crm_campaigns" ON public.crm_campaigns
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- crm_cohorts -------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_crm_cohorts" ON public.crm_cohorts;
DROP POLICY IF EXISTS "authenticated_insert_crm_cohorts" ON public.crm_cohorts;
DROP POLICY IF EXISTS "authenticated_update_crm_cohorts" ON public.crm_cohorts;
DROP POLICY IF EXISTS "authenticated_delete_crm_cohorts" ON public.crm_cohorts;

CREATE POLICY "staff_select_crm_cohorts" ON public.crm_cohorts
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_crm_cohorts" ON public.crm_cohorts
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_crm_cohorts" ON public.crm_cohorts
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_crm_cohorts" ON public.crm_cohorts
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- crm_campaign_executions -------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_crm_executions" ON public.crm_campaign_executions;
DROP POLICY IF EXISTS "authenticated_insert_crm_executions" ON public.crm_campaign_executions;
DROP POLICY IF EXISTS "authenticated_update_crm_executions" ON public.crm_campaign_executions;
DROP POLICY IF EXISTS "authenticated_delete_crm_executions" ON public.crm_campaign_executions;

CREATE POLICY "staff_select_crm_executions" ON public.crm_campaign_executions
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_crm_executions" ON public.crm_campaign_executions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_crm_executions" ON public.crm_campaign_executions
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_crm_executions" ON public.crm_campaign_executions
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- manychat_tags -----------------------------------------------------------
DROP POLICY IF EXISTS "auth_select_manychat_tags" ON public.manychat_tags;
DROP POLICY IF EXISTS "auth_insert_manychat_tags" ON public.manychat_tags;
DROP POLICY IF EXISTS "auth_update_manychat_tags" ON public.manychat_tags;
DROP POLICY IF EXISTS "auth_delete_manychat_tags" ON public.manychat_tags;

CREATE POLICY "staff_select_manychat_tags" ON public.manychat_tags
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_manychat_tags" ON public.manychat_tags
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_manychat_tags" ON public.manychat_tags
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_manychat_tags" ON public.manychat_tags
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- manychat_flows ----------------------------------------------------------
DROP POLICY IF EXISTS "auth_select_manychat_flows" ON public.manychat_flows;
DROP POLICY IF EXISTS "auth_insert_manychat_flows" ON public.manychat_flows;
DROP POLICY IF EXISTS "auth_update_manychat_flows" ON public.manychat_flows;
DROP POLICY IF EXISTS "auth_delete_manychat_flows" ON public.manychat_flows;

CREATE POLICY "staff_select_manychat_flows" ON public.manychat_flows
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_manychat_flows" ON public.manychat_flows
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_manychat_flows" ON public.manychat_flows
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_manychat_flows" ON public.manychat_flows
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- manychat_custom_fields --------------------------------------------------
DROP POLICY IF EXISTS "auth_select_manychat_custom_fields" ON public.manychat_custom_fields;
DROP POLICY IF EXISTS "auth_insert_manychat_custom_fields" ON public.manychat_custom_fields;
DROP POLICY IF EXISTS "auth_update_manychat_custom_fields" ON public.manychat_custom_fields;
DROP POLICY IF EXISTS "auth_delete_manychat_custom_fields" ON public.manychat_custom_fields;

CREATE POLICY "staff_select_manychat_custom_fields" ON public.manychat_custom_fields
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_manychat_custom_fields" ON public.manychat_custom_fields
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_manychat_custom_fields" ON public.manychat_custom_fields
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_manychat_custom_fields" ON public.manychat_custom_fields
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- manychat_system_fields --------------------------------------------------
DROP POLICY IF EXISTS "auth_select_manychat_system_fields" ON public.manychat_system_fields;
DROP POLICY IF EXISTS "auth_insert_manychat_system_fields" ON public.manychat_system_fields;
DROP POLICY IF EXISTS "auth_update_manychat_system_fields" ON public.manychat_system_fields;
DROP POLICY IF EXISTS "auth_delete_manychat_system_fields" ON public.manychat_system_fields;

CREATE POLICY "staff_select_manychat_system_fields" ON public.manychat_system_fields
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_manychat_system_fields" ON public.manychat_system_fields
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_manychat_system_fields" ON public.manychat_system_fields
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_manychat_system_fields" ON public.manychat_system_fields
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- blog_posts: writes are staff-only, public read of published posts unchanged
DROP POLICY IF EXISTS "Authenticated users can insert blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authenticated users can update blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authenticated users can delete blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authenticated users can read all blog posts" ON public.blog_posts;

CREATE POLICY "staff_select_blog_posts" ON public.blog_posts
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_blog_posts" ON public.blog_posts
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_blog_posts" ON public.blog_posts
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_blog_posts" ON public.blog_posts
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- protein_orders: no anonymous inserts
DROP POLICY IF EXISTS "Anon can insert protein orders" ON public.protein_orders;
