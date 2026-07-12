export interface GmailConfig {
  id: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  access_token: string;
  token_expiry: string | null;
  connected_email: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_label: string;
  created_at: string;
  updated_at: string;
}

export interface GmailConfigForm {
  client_id: string;
  client_secret: string;
  sync_label: string;
}

export interface ExtractedInvoiceData {
  supplier_name?: string;
  supplier_rfc?: string;
  invoice_number?: string;
  invoice_date?: string;
  subtotal?: number;
  iva?: number;
  isr?: number;
  total?: number;
  currency?: string;
  description?: string;
  confidence: number;
  original_total?: number;
  original_subtotal?: number;
  original_iva?: number;
  original_isr?: number;
  original_currency?: string;
  applied_exchange_rate?: number;
}

export interface GmailInvoiceImport {
  id: string;
  import_id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  from_email: string;
  from_name: string;
  subject: string;
  received_at: string;
  source_type: 'body' | 'pdf' | 'xml';
  status: 'pending' | 'approved' | 'rejected' | 'error';
  extracted_data: ExtractedInvoiceData;
  expense_id: string | null;
  rejection_reason: string | null;
  raw_body_preview: string | null;
  attachment_filename: string | null;
  matched_rule_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GmailInvoiceRule {
  id: string;
  rule_name: string;
  sender_email_pattern: string;
  subject_pattern: string | null;
  rule_action: 'classify' | 'discard';
  expense_concept_id: string | null;
  supplier_id: string | null;
  bank_account_id: string | null;
  exchange_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGmailInvoiceRule {
  rule_name: string;
  sender_email_pattern: string;
  subject_pattern?: string;
  rule_action?: 'classify' | 'discard';
  expense_concept_id?: string;
  supplier_id?: string;
  bank_account_id?: string;
  exchange_rate?: number;
  is_active?: boolean;
}

export interface UpdateGmailInvoiceRule {
  rule_name?: string;
  sender_email_pattern?: string;
  subject_pattern?: string | null;
  rule_action?: 'classify' | 'discard';
  expense_concept_id?: string | null;
  supplier_id?: string | null;
  bank_account_id?: string | null;
  exchange_rate?: number | null;
  is_active?: boolean;
}
