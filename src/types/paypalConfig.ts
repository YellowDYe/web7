export interface PayPalConfig {
  id: string;
  client_id: string;
  client_secret: string;
  environment: 'sandbox' | 'production';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayPalConfigForm {
  client_id: string;
  client_secret: string;
  environment: 'sandbox' | 'production';
}

export interface PayPalAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface PayPalInvoiceItem {
  name: string;
  description?: string;
  quantity: string;
  unit_amount: {
    currency_code: string;
    value: string;
  };
  tax?: {
    name?: string;
    percent?: string;
    amount?: PayPalInvoiceAmount;
    tax_note?: string;
  };
  discount?: {
    percent?: string;
    amount?: PayPalInvoiceAmount;
  };
  unit_of_measure?: string;
}

export interface PayPalInvoiceAmount {
  currency_code: string;
  value: string;
}

export interface PayPalInvoiceDetail {
  invoice_number?: string;
  reference?: string;
  invoice_date?: string;
  currency_code: string;
  note?: string;
  term?: string;
  memo?: string;
  payment_term?: {
    term_type?: string;
    due_date?: string;
  };
}

export interface PayPalInvoicerInfo {
  name?: {
    given_name?: string;
    surname?: string;
  };
  email_address: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    admin_area_2?: string;
    admin_area_1?: string;
    postal_code?: string;
    country_code?: string;
  };
  phones?: Array<{
    country_code?: string;
    national_number?: string;
    phone_type?: string;
  }>;
  website?: string;
  tax_id?: string;
  logo_url?: string;
  additional_notes?: string;
}

export interface PayPalBillingInfo {
  email_address: string;
  name?: {
    given_name?: string;
    surname?: string;
  };
  phones?: Array<{
    country_code?: string;
    national_number?: string;
    phone_type?: string;
  }>;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    admin_area_2?: string;
    admin_area_1?: string;
    postal_code?: string;
    country_code?: string;
  };
  additional_info_value?: string;
}

export interface PayPalShippingInfo {
  name?: {
    given_name?: string;
    surname?: string;
  };
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    admin_area_2?: string;
    admin_area_1?: string;
    postal_code?: string;
    country_code?: string;
  };
}

export interface PayPalInvoiceConfiguration {
  tax_calculated_after_discount?: boolean;
  tax_inclusive?: boolean;
  allow_tip?: boolean;
  partial_payment?: {
    allow_partial_payment?: boolean;
    minimum_amount_due?: PayPalInvoiceAmount;
  };
  template_id?: string;
}

export interface PayPalInvoiceRequest {
  detail: PayPalInvoiceDetail;
  invoicer: PayPalInvoicerInfo;
  primary_recipients: Array<{
    billing_info: PayPalBillingInfo;
    shipping_info?: PayPalShippingInfo;
  }>;
  additional_recipients?: string[];
  items: PayPalInvoiceItem[];
  configuration?: PayPalInvoiceConfiguration;
  amount?: {
    breakdown?: {
      custom?: {
        label?: string;
        amount?: PayPalInvoiceAmount;
      };
      shipping?: {
        amount?: PayPalInvoiceAmount;
        tax?: {
          name?: string;
          percent?: string;
          amount?: PayPalInvoiceAmount;
        };
      };
      discount?: {
        item_discount?: {
          amount?: PayPalInvoiceAmount;
        };
        invoice_discount?: {
          percent?: string;
          amount?: PayPalInvoiceAmount;
        };
      };
    };
  };
  payments?: {
    paid_amount?: PayPalInvoiceAmount;
    transactions?: Array<any>;
  };
  refunds?: {
    refund_amount?: PayPalInvoiceAmount;
    transactions?: Array<any>;
  };
}

export interface PayPalInvoiceResponse {
  id: string;
  status: 'DRAFT' | 'SENT' | 'SCHEDULED' | 'PAID' | 'MARKED_AS_PAID' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_PAID' | 'PARTIALLY_REFUNDED' | 'MARKED_AS_REFUNDED' | 'UNPAID' | 'PAYMENT_PENDING';
  detail: PayPalInvoiceDetail & {
    invoice_number: string;
    viewed_by_recipient?: boolean;
  };
  invoicer: PayPalInvoicerInfo;
  primary_recipients: Array<{
    billing_info: PayPalBillingInfo;
    shipping_info?: PayPalShippingInfo;
  }>;
  additional_recipients?: string[];
  items: PayPalInvoiceItem[];
  configuration?: PayPalInvoiceConfiguration;
  amount: {
    currency_code: string;
    value: string;
    breakdown?: {
      item_total?: PayPalInvoiceAmount;
      custom?: {
        label?: string;
        amount?: PayPalInvoiceAmount;
      };
      tax_total?: PayPalInvoiceAmount;
      shipping?: {
        amount?: PayPalInvoiceAmount;
        tax?: {
          name?: string;
          percent?: string;
          amount?: PayPalInvoiceAmount;
        };
      };
      discount?: {
        item_discount?: {
          amount?: PayPalInvoiceAmount;
        };
        invoice_discount?: {
          percent?: string;
          amount?: PayPalInvoiceAmount;
        };
      };
    };
  };
  due_amount?: PayPalInvoiceAmount;
  gratuity?: PayPalInvoiceAmount;
  payments?: {
    paid_amount?: PayPalInvoiceAmount;
    transactions?: Array<any>;
  };
  refunds?: {
    refund_amount?: PayPalInvoiceAmount;
    transactions?: Array<any>;
  };
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  href?: string;
}

export interface PayPalErrorResponse {
  name: string;
  message: string;
  debug_id?: string;
  details?: Array<{
    issue: string;
    description: string;
  }>;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalSendInvoiceRequest {
  send_to_recipient?: boolean;
  send_to_invoicer?: boolean;
  additional_recipients?: string[];
  note?: string;
  subject?: string;
}
