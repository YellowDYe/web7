export interface Invoice {
  id: string;
  invoice_id: string;
  order_id: string;
  invoice_number: string;
  invoice_date: string;
  payment_date: string | null;
  customer_name: string;
  customer_email: string;
  subtotal: number;
  delivery_option_price: number;
  tax_amount: number;
  delivery_tax_amount: number;
  total_amount: number;
  invoice_summary: string;
  invoice_status: 'draft' | 'paid' | 'cancelled';
  bank_account_id: string | null;
  plan_discount_amount: number;
  coupon_discount_amount: number;
  custom_discount_amount: number;
  invoice_group_id: string | null;
  paypal_invoice_id: string | null;
  paypal_invoice_status: string | null;
  paypal_sent_at: string | null;
  paypal_invoice_number: string | null;
  recipient_view_url: string | null;
  facturama_cfdi_id: string | null;
  facturama_cfdi_uuid: string | null;
  facturama_cfdi_status: string | null;
  facturama_cfdi_pdf_url: string | null;
  facturama_cfdi_xml_url: string | null;
  facturama_cfdi_created_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceData {
  order_id: string;
  customer_name: string;
  customer_email: string;
  invoice_summary: string;
  invoice_status?: 'draft' | 'paid' | 'cancelled';
  payment_date?: string | null;
  subtotal?: number;
  delivery_option_price?: number;
  tax_amount?: number;
  delivery_tax_amount?: number;
  total_amount?: number;
  bank_account_id?: string;
  plan_discount_amount?: number;
  coupon_discount_amount?: number;
  custom_discount_amount?: number;
  invoice_group_id?: string | null;
}

export interface UpdateInvoiceData {
  customer_name?: string;
  customer_email?: string;
  subtotal?: number;
  delivery_option_price?: number;
  tax_amount?: number;
  delivery_tax_amount?: number;
  total_amount?: number;
  invoice_summary?: string;
  invoice_status?: 'draft' | 'paid' | 'cancelled';
  payment_date?: string | null;
  bank_account_id?: string | null;
  plan_discount_amount?: number;
  coupon_discount_amount?: number;
  custom_discount_amount?: number;
  paypal_invoice_id?: string | null;
  paypal_invoice_status?: string | null;
  paypal_sent_at?: string | null;
  paypal_invoice_number?: string | null;
  recipient_view_url?: string | null;
  facturama_cfdi_id?: string | null;
  facturama_cfdi_uuid?: string | null;
  facturama_cfdi_status?: string | null;
  facturama_cfdi_pdf_url?: string | null;
  facturama_cfdi_xml_url?: string | null;
  facturama_cfdi_created_at?: string | null;
}

export interface InvoiceLineItem {
  week_name: string;
  plan_name: string;
  total_dishes: number;
  subtotal: number;
}