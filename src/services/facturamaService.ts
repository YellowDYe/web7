import { supabase } from '../config/supabase';
import { facturamaConfigService } from './facturamaConfigService';
import {
  FacturamaCfdiRequest,
  FacturamaCfdiResponse,
  FacturamaItem,
  FacturamaTax,
  FacturamaErrorResponse,
  FacturamaRelation,
  isCfdiUseCompatible,
} from '../types/facturamaConfig';
import { Invoice } from '../types/invoice';
import { Customer } from '../types/customer';
import { mailgunService } from './mailgunService';

const IVA_RATE = 0.16;
const IVA_NAME = 'IVA';

class FacturamaService {
  private async getAuthHeader(): Promise<string> {
    const config = await facturamaConfigService.getFacturamaConfig();
    if (!config || !config.username || !config.password) {
      throw new Error('Facturama no está configurado. Configure las credenciales en la sección de Administración.');
    }
    return 'Basic ' + btoa(`${config.username}:${config.password}`);
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const config = await facturamaConfigService.getFacturamaConfig();
    if (!config) throw new Error('Facturama no está configurado');

    const baseUrl = facturamaConfigService.getBaseUrl(config.environment);
    const auth = await this.getAuthHeader();

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${endpoint}`, options);

    if (!response.ok) {
      let errorMessage = `Error de Facturama: ${response.status} ${response.statusText}`;
      try {
        const rawText = await response.text();
        console.error('[Facturama] Error response body:', rawText);
        const errorData: FacturamaErrorResponse = JSON.parse(rawText);
        if (errorData.ModelState) {
          const details = Object.values(errorData.ModelState).flat().join('. ');
          errorMessage = details || errorData.Message || errorMessage;
        } else if (errorData.Details) {
          const allDetails: string[] = [];
          Object.values(errorData.Details).forEach(arr => {
            arr.forEach(msg => {
              if (msg && typeof msg === 'string') allDetails.push(msg);
            });
          });
          errorMessage = allDetails.join('. ') || errorMessage;
        } else if (errorData.Message) {
          try {
            const nested = JSON.parse(errorData.Message);
            if (nested && typeof nested === 'object') {
              const nestedDetails = nested.Details || nested.ModelState;
              if (nestedDetails) {
                const msgs = Object.values(nestedDetails as Record<string, string[]>).flat().join('. ');
                errorMessage = msgs || nested.Message || errorData.Message;
              } else {
                errorMessage = nested.Message || errorData.Message;
              }
            } else {
              errorMessage = errorData.Message;
            }
          } catch {
            errorMessage = errorData.Message;
          }
        }
      } catch {
        // Ignore JSON parse error
      }
      if (
        errorMessage.toLowerCase().includes('nombre') &&
        (errorMessage.toLowerCase().includes('receptor') || errorMessage.toLowerCase().includes('rfc'))
      ) {
        errorMessage += ' — Verifique que el nombre de facturación del cliente coincida exactamente (mayúsculas, espacios, caracteres especiales) con el nombre registrado ante el SAT para ese RFC.';
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private buildItemsFromInvoice(
    invoice: Invoice,
    productCode: string,
    unitCode: string,
    unitName: string,
    overrides?: { mealDescription?: string; deliveryDescription?: string }
  ): FacturamaItem[] {
    const grossSubtotal = parseFloat(Number(invoice.subtotal || 0).toFixed(2));
    const planDiscount = parseFloat(Number(invoice.plan_discount_amount || 0).toFixed(2));
    const couponDiscount = parseFloat(Number(invoice.coupon_discount_amount || 0).toFixed(2));
    const customDiscount = parseFloat(Number(invoice.custom_discount_amount || 0).toFixed(2));

    // Coupon and custom discounts are post-tax amounts applied to the final total.
    // Convert to pre-tax equivalents so the CFDI reflects the correct taxable base.
    const postTaxDiscount = couponDiscount + customDiscount;
    const additionalPreTaxDiscount = postTaxDiscount > 0
      ? parseFloat((postTaxDiscount / (1 + IVA_RATE)).toFixed(2))
      : 0;

    const totalMealDiscount = parseFloat((planDiscount + additionalPreTaxDiscount).toFixed(2));
    const netBase = parseFloat((grossSubtotal - totalMealDiscount).toFixed(2));
    const derivedMealTax = parseFloat((netBase * IVA_RATE).toFixed(2));
    const deliveryBase = parseFloat(Number(invoice.delivery_option_price || 0).toFixed(2));
    const derivedDeliveryTax = parseFloat((deliveryBase * IVA_RATE).toFixed(2));

    const description = overrides?.mealDescription || invoice.invoice_summary || `Resumen de pedido ${invoice.invoice_number}`;

    const mealTax_: FacturamaTax = {
      Total: derivedMealTax,
      Name: IVA_NAME,
      Base: netBase,
      Rate: IVA_RATE,
      IsRetention: false,
    };

    const mealItem: FacturamaItem = {
      ProductCode: productCode,
      Description: description,
      Unit: unitName,
      UnitCode: unitCode,
      UnitPrice: grossSubtotal,
      Quantity: 1,
      Subtotal: grossSubtotal,
      Discount: totalMealDiscount,
      TaxObject: '02',
      Taxes: [mealTax_],
      Total: parseFloat((netBase + derivedMealTax).toFixed(2)),
    };

    const items: FacturamaItem[] = [mealItem];

    if (deliveryBase > 0) {
      const deliveryTax_: FacturamaTax = {
        Total: derivedDeliveryTax,
        Name: IVA_NAME,
        Base: deliveryBase,
        Rate: IVA_RATE,
        IsRetention: false,
      };

      const deliveryDesc = overrides?.deliveryDescription || 'Servicio de entrega a domicilio';

      items.push({
        ProductCode: '78102203',
        Description: deliveryDesc,
        Unit: 'Servicio',
        UnitCode: 'E48',
        UnitPrice: deliveryBase,
        Quantity: 1,
        Subtotal: deliveryBase,
        TaxObject: '02',
        Taxes: [deliveryTax_],
        Total: parseFloat((deliveryBase + derivedDeliveryTax).toFixed(2)),
      });
    }

    return items;
  }

  private buildItemsFromInvoices(
    invoices: Invoice[],
    productCode: string,
    unitCode: string,
    unitName: string
  ): FacturamaItem[] {
    const items: FacturamaItem[] = [];

    for (const invoice of invoices) {
      items.push(...this.buildItemsFromInvoice(invoice, productCode, unitCode, unitName));
    }

    return items;
  }

  private logCfdiPayload(label: string, cfdiRequest: FacturamaCfdiRequest): void {
    const items = cfdiRequest.Items;

    console.group(`%c[Facturama] ${label}`, 'color: #e67e00; font-weight: bold; font-size: 13px');

    console.log('%cPayload completo (JSON):', 'color: #666; font-style: italic');
    console.log(JSON.stringify(cfdiRequest, null, 2));

    console.log('%cDesglose por partida:', 'color: #666; font-style: italic');
    const itemRows: Record<string, string | number> = {};
    items.forEach((it, i) => {
      const discount = it.Discount || 0;
      const taxBase = it.Taxes?.[0]?.Base ?? parseFloat((it.Subtotal - discount).toFixed(2));
      const taxTotal = it.Taxes?.[0]?.Total ?? 0;
      const expectedTotal = parseFloat((taxBase + taxTotal).toFixed(2));
      const match = Math.abs(it.Total - expectedTotal) < 0.01 ? '✓' : '✗ MISMATCH';
      itemRows[`[${i + 1}] ${it.Description.substring(0, 40)}`] = {
        UnitPrice: it.UnitPrice.toFixed(6),
        Qty: it.Quantity,
        Subtotal: it.Subtotal.toFixed(2),
        Discount: discount.toFixed(2),
        'Tax.Base': taxBase.toFixed(2),
        'Tax.IVA': taxTotal.toFixed(2),
        Total: it.Total.toFixed(2),
        Check: match,
      } as any;
    });
    console.table(itemRows);

    const totals = items.reduce(
      (acc, it) => ({
        subtotal: acc.subtotal + it.Subtotal,
        discount: acc.discount + (it.Discount || 0),
        taxBase: acc.taxBase + (it.Taxes?.[0]?.Base ?? parseFloat((it.Subtotal - (it.Discount || 0)).toFixed(2))),
        taxIva: acc.taxIva + (it.Taxes?.[0]?.Total || 0),
        total: acc.total + it.Total,
      }),
      { subtotal: 0, discount: 0, taxBase: 0, taxIva: 0, total: 0 }
    );

    const crossCheckTotal = parseFloat(((totals.subtotal - totals.discount) * (1 + IVA_RATE)).toFixed(2));
    const summedTotal = parseFloat(totals.total.toFixed(2));
    const hasMismatch = Math.abs(crossCheckTotal - summedTotal) >= 0.02;

    console.log('%cResumen de totales:', 'color: #666; font-style: italic');
    console.table({
      'Subtotal (suma partidas)': totals.subtotal.toFixed(2),
      'Descuentos (suma partidas)': totals.discount.toFixed(2),
      'Base gravable (suma partidas)': totals.taxBase.toFixed(2),
      'IVA 16% (suma partidas)': totals.taxIva.toFixed(2),
      'Total (suma partidas)': summedTotal.toFixed(2),
      'Total cross-check (subtotal-desc)*1.16': crossCheckTotal.toFixed(2),
      'Diferencia': (summedTotal - crossCheckTotal).toFixed(2),
    });

    if (hasMismatch) {
      console.warn(
        `%c[Facturama] ADVERTENCIA: El total sumado (${summedTotal.toFixed(2)}) difiere del cross-check (${crossCheckTotal.toFixed(2)}) en ${Math.abs(summedTotal - crossCheckTotal).toFixed(2)} MXN. ` +
        'Esto puede causar que el CFDI de Facturama tenga un total diferente al esperado.',
        'color: red; font-weight: bold;'
      );
    } else {
      console.log('%c[Facturama] Cross-check OK — totales consistentes.', 'color: green; font-weight: bold;');
    }

    console.groupEnd();
  }

  buildCfdiPayloadPreview(
    invoice: Invoice,
    customer: Customer,
    config: { default_product_key: string; default_unit_key: string; default_unit_name: string; issuer_postal_code: string },
    overrides?: { mealDescription?: string; deliveryDescription?: string; paymentMethod?: string; paymentForm?: string }
  ): { request: FacturamaCfdiRequest; items: FacturamaItem[] } {
    const cfdiUse = (customer as any).cfdi_use || 'G03';
    const normalizedRfc = customer.rfc?.toUpperCase().trim() || '';
    const normalizedName = customer.billing_name?.toUpperCase().trim().replace(/\s+/g, ' ') || '';
    const normalizedRegime = customer.tax_regime?.split(' ')[0].trim() || '';
    const normalizedZip = String(customer.billing_postal_code || '').padStart(5, '0');

    const items = this.buildItemsFromInvoice(
      invoice,
      config.default_product_key,
      config.default_unit_key,
      config.default_unit_name,
      overrides
    );

    const request: FacturamaCfdiRequest = {
      NameId: '1',
      CfdiType: 'I',
      Currency: 'MXN',
      PaymentForm: overrides?.paymentForm || '03',
      PaymentMethod: overrides?.paymentMethod || 'PUE',
      Exportation: '01',
      ExpeditionPlace: config.issuer_postal_code,
      Receiver: {
        Rfc: normalizedRfc,
        Name: normalizedName,
        CfdiUse: cfdiUse,
        FiscalRegime: normalizedRegime,
        TaxZipCode: normalizedZip,
      },
      Items: items,
    };

    return { request, items };
  }

  async createCfdi(
    invoice: Invoice,
    customer: Customer,
    overrides?: { mealDescription?: string; deliveryDescription?: string; paymentMethod?: string; paymentForm?: string }
  ): Promise<FacturamaCfdiResponse> {
    const config = await facturamaConfigService.getFacturamaConfig();
    if (!config) throw new Error('Facturama no está configurado');

    if (!customer.rfc) throw new Error('El cliente no tiene RFC registrado');
    if (!customer.billing_name) throw new Error('El cliente no tiene razón social registrada');
    if (!customer.tax_regime) throw new Error('El cliente no tiene régimen fiscal registrado');
    if (!customer.billing_postal_code) throw new Error('El cliente no tiene código postal fiscal registrado');
    if (!config.issuer_postal_code) throw new Error('El código postal del lugar de expedición no está configurado. Ve a Administración > Facturama y configura el código postal.');

    const cfdiUseForValidation = (customer as any).cfdi_use || 'G03';
    if (!isCfdiUseCompatible(customer.tax_regime, cfdiUseForValidation)) {
      throw new Error(
        `El Uso CFDI "${cfdiUseForValidation}" no es compatible con el Régimen Fiscal "${customer.tax_regime}". ` +
        `Edita el perfil del cliente y selecciona un Uso CFDI válido para ese régimen.`
      );
    }

    const items = this.buildItemsFromInvoice(
      invoice,
      config.default_product_key,
      config.default_unit_key,
      config.default_unit_name,
      overrides
    );

    const cfdiUse = (customer as any).cfdi_use || 'G03';

    const normalizedRfc = customer.rfc.toUpperCase().trim();
    const normalizedName = customer.billing_name.toUpperCase().trim().replace(/\s+/g, ' ');
    const normalizedRegime = customer.tax_regime.split(' ')[0].trim();
    const normalizedZip = String(customer.billing_postal_code).padStart(5, '0');

    console.log('[Facturama] Receiver fields:');
    console.log('  Rfc:', JSON.stringify(normalizedRfc));
    console.log('  Name:', JSON.stringify(normalizedName));
    console.log('  CfdiUse:', JSON.stringify(cfdiUse));
    console.log('  FiscalRegime:', JSON.stringify(normalizedRegime));
    console.log('  TaxZipCode:', JSON.stringify(normalizedZip));

    const cfdiRequest: FacturamaCfdiRequest = {
      NameId: '1',
      CfdiType: 'I',
      Currency: 'MXN',
      PaymentForm: overrides?.paymentForm || '03',
      PaymentMethod: overrides?.paymentMethod || 'PUE',
      Exportation: '01',
      ExpeditionPlace: config.issuer_postal_code,
      Receiver: {
        Rfc: normalizedRfc,
        Name: normalizedName,
        CfdiUse: cfdiUse,
        FiscalRegime: normalizedRegime,
        TaxZipCode: normalizedZip,
      },
      Items: items,
    };

    this.logCfdiPayload('CFDI a enviar (pedido individual)', cfdiRequest);

    const response = await this.makeRequest<FacturamaCfdiResponse>('/3/cfdis', 'POST', cfdiRequest);

    console.log('[Facturama] CFDI created:', response);

    if ((response as any).success === false) {
      throw new Error((response as any).msj || 'Error al crear el CFDI en Facturama');
    }

    const cfdiUuid = response.Complement?.TaxStamp?.Uuid || null;
    const cfdiStatus = response.Status || 'active';

    // Persist CFDI data to the invoice record
    await supabase
      .from('invoices')
      .update({
        facturama_cfdi_id: response.Id,
        facturama_cfdi_uuid: cfdiUuid,
        facturama_cfdi_status: cfdiStatus,
        facturama_cfdi_created_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    // Record CFDI in the audit log table
    await this.recordCfdi({
      facturama_cfdi_id: response.Id,
      cfdi_uuid: cfdiUuid,
      cfdi_status: cfdiStatus,
      cfdi_date: response.Date ? new Date(response.Date).toISOString() : new Date().toISOString(),
      invoice_ids: [invoice.id],
      invoice_numbers: [invoice.invoice_number],
      customer,
      issuer_rfc: config.issuer_rfc,
      issuer_name: config.issuer_name,
      items,
      paymentMethod: overrides?.paymentMethod || 'PUE',
      paymentForm: overrides?.paymentForm || '03',
    });

    return response;
  }

  private async recordCfdi(data: {
    facturama_cfdi_id: string;
    cfdi_uuid: string | null;
    cfdi_status: string;
    cfdi_date: string;
    invoice_ids: string[];
    invoice_numbers: string[];
    customer: Customer;
    issuer_rfc: string;
    issuer_name: string;
    items: FacturamaItem[];
    paymentMethod?: string;
    paymentForm?: string;
  }): Promise<void> {
    const subtotal = data.items.reduce((sum, item) => sum + (item.Subtotal || 0), 0);
    const discount = data.items.reduce((sum, item) => sum + (item.Discount || 0), 0);
    const taxAmount = data.items.reduce((sum, item) => {
      const itemTax = (item.Taxes || []).reduce((t, tx) => t + (tx.Total || 0), 0);
      return sum + itemTax;
    }, 0);
    const totalAmount = data.items.reduce((sum, item) => sum + (item.Total || 0), 0);

    await supabase.from('cfdis').insert({
      facturama_cfdi_id: data.facturama_cfdi_id,
      cfdi_uuid: data.cfdi_uuid,
      cfdi_status: data.cfdi_status,
      cfdi_date: data.cfdi_date,
      invoice_ids: data.invoice_ids,
      invoice_numbers: data.invoice_numbers,
      customer_id: data.customer.customer_id,
      customer_name: `${data.customer.customer_name} ${data.customer.customer_lastname}`.trim(),
      customer_rfc: data.customer.rfc?.toUpperCase().trim() || null,
      customer_billing_name: data.customer.billing_name?.toUpperCase().trim() || null,
      customer_tax_regime: data.customer.tax_regime || null,
      customer_cfdi_use: (data.customer as any).cfdi_use || 'G03',
      issuer_rfc: data.issuer_rfc,
      issuer_name: data.issuer_name,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_amount: parseFloat(discount.toFixed(2)),
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      total_amount: parseFloat(totalAmount.toFixed(2)),
      payment_form: data.paymentForm || '03',
      payment_method: data.paymentMethod || 'PUE',
      currency: 'MXN',
    });
  }

  async buildCfdiPayload(
    customer: Customer,
    invoices: Invoice[],
    cfdiUseOverride?: string,
    paymentOverrides?: { paymentMethod?: string; paymentForm?: string }
  ): Promise<FacturamaCfdiRequest> {
    const config = await facturamaConfigService.getFacturamaConfig();
    if (!config) throw new Error('Facturama no está configurado');

    const items = this.buildItemsFromInvoices(
      invoices,
      config.default_product_key,
      config.default_unit_key,
      config.default_unit_name
    );

    const cfdiUse = cfdiUseOverride || (customer as any).cfdi_use || 'G03';
    const normalizedRfc = customer.rfc!.toUpperCase().trim();
    const normalizedName = customer.billing_name!.toUpperCase().trim().replace(/\s+/g, ' ');
    const normalizedRegime = customer.tax_regime!.split(' ')[0].trim();
    const normalizedZip = String(customer.billing_postal_code).padStart(5, '0');

    return {
      NameId: '1',
      CfdiType: 'I',
      Currency: 'MXN',
      PaymentForm: paymentOverrides?.paymentForm || '03',
      PaymentMethod: paymentOverrides?.paymentMethod || 'PUE',
      Exportation: '01',
      ExpeditionPlace: config.issuer_postal_code,
      Receiver: {
        Rfc: normalizedRfc,
        Name: normalizedName,
        CfdiUse: cfdiUse,
        FiscalRegime: normalizedRegime,
        TaxZipCode: normalizedZip,
      },
      Items: items,
    };
  }

  async createCfdiForMultipleOrders(
    customer: Customer,
    invoices: Invoice[],
    primaryInvoiceId: string,
    cfdiUseOverride?: string,
    paymentOverrides?: { paymentMethod?: string; paymentForm?: string }
  ): Promise<FacturamaCfdiResponse> {
    const config = await facturamaConfigService.getFacturamaConfig();
    if (!config) throw new Error('Facturama no está configurado');

    if (!customer.rfc) throw new Error('El cliente no tiene RFC registrado');
    if (!customer.billing_name) throw new Error('El cliente no tiene razón social registrada');
    if (!customer.tax_regime) throw new Error('El cliente no tiene régimen fiscal registrado');
    if (!customer.billing_postal_code) throw new Error('El cliente no tiene código postal fiscal registrado');
    if (!config.issuer_postal_code) throw new Error('El código postal del lugar de expedición no está configurado. Ve a Administración > Facturama y configura el código postal.');

    const cfdiUse = cfdiUseOverride || (customer as any).cfdi_use || 'G03';
    if (!isCfdiUseCompatible(customer.tax_regime, cfdiUse)) {
      throw new Error(
        `El Uso CFDI "${cfdiUse}" no es compatible con el Régimen Fiscal "${customer.tax_regime}". ` +
        `Edita el perfil del cliente y selecciona un Uso CFDI válido para ese régimen.`
      );
    }

    const items = this.buildItemsFromInvoices(
      invoices,
      config.default_product_key,
      config.default_unit_key,
      config.default_unit_name
    );
    const normalizedRfc = customer.rfc.toUpperCase().trim();
    const normalizedName = customer.billing_name.toUpperCase().trim().replace(/\s+/g, ' ');
    const normalizedRegime = customer.tax_regime.split(' ')[0].trim();
    const normalizedZip = String(customer.billing_postal_code).padStart(5, '0');

    const cfdiRequest: FacturamaCfdiRequest = {
      NameId: '1',
      CfdiType: 'I',
      Currency: 'MXN',
      PaymentForm: paymentOverrides?.paymentForm || '03',
      PaymentMethod: paymentOverrides?.paymentMethod || 'PUE',
      Exportation: '01',
      ExpeditionPlace: config.issuer_postal_code,
      Receiver: {
        Rfc: normalizedRfc,
        Name: normalizedName,
        CfdiUse: cfdiUse,
        FiscalRegime: normalizedRegime,
        TaxZipCode: normalizedZip,
      },
      Items: items,
    };

    this.logCfdiPayload('CFDI Multi-Pedido a enviar', cfdiRequest);

    const response = await this.makeRequest<FacturamaCfdiResponse>('/3/cfdis', 'POST', cfdiRequest);

    if ((response as any).success === false) {
      throw new Error((response as any).msj || 'Error al crear el CFDI en Facturama');
    }

    const cfdiUuidMulti = response.Complement?.TaxStamp?.Uuid || null;
    const cfdiStatusMulti = response.Status || 'active';

    await supabase
      .from('invoices')
      .update({
        facturama_cfdi_id: response.Id,
        facturama_cfdi_uuid: cfdiUuidMulti,
        facturama_cfdi_status: cfdiStatusMulti,
        facturama_cfdi_created_at: new Date().toISOString(),
      })
      .eq('id', primaryInvoiceId);

    // Record CFDI in the audit log table
    await this.recordCfdi({
      facturama_cfdi_id: response.Id,
      cfdi_uuid: cfdiUuidMulti,
      cfdi_status: cfdiStatusMulti,
      cfdi_date: response.Date ? new Date(response.Date).toISOString() : new Date().toISOString(),
      invoice_ids: invoices.map(inv => inv.id),
      invoice_numbers: invoices.map(inv => inv.invoice_number),
      customer,
      issuer_rfc: config.issuer_rfc,
      issuer_name: config.issuer_name,
      items,
      paymentMethod: paymentOverrides?.paymentMethod || 'PUE',
      paymentForm: paymentOverrides?.paymentForm || '03',
    });

    return response;
  }

  async getCfdi(cfdiId: string): Promise<FacturamaCfdiResponse> {
    return this.makeRequest<FacturamaCfdiResponse>(`/api-lite/cfdis/${cfdiId}`);
  }

  async downloadCfdiPdf(cfdiId: string): Promise<Blob> {
    const fileViewModel = await this.makeRequest<{ Content: string }>(`/Cfdi/pdf/issued/${cfdiId}`);
    const base64Content = fileViewModel.Content;
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'application/pdf' });
  }

  async downloadCfdiXml(cfdiId: string): Promise<string> {
    const fileViewModel = await this.makeRequest<{ Content: string }>(`/Cfdi/xml/issued/${cfdiId}`);
    const base64Content = fileViewModel.Content;
    return atob(base64Content);
  }

  async cancelCfdi(cfdiId: string, invoiceId: string, motive: '01' | '02' = '02', uuidReplacement?: string): Promise<void> {
    let endpoint = `/api-lite/cfdis/${cfdiId}?motive=${motive}`;
    if (motive === '01' && uuidReplacement) {
      endpoint += `&uuidReplacement=${uuidReplacement}`;
    }
    await this.makeRequest(endpoint, 'DELETE');

    await supabase
      .from('invoices')
      .update({ facturama_cfdi_status: 'cancelled' })
      .eq('id', invoiceId)
      .eq('facturama_cfdi_id', cfdiId);

    await supabase
      .from('cfdis')
      .update({
        cfdi_status: 'cancelled',
        cancellation_motive: motive,
        updated_at: new Date().toISOString(),
      })
      .eq('facturama_cfdi_id', cfdiId);
  }

  async getCfdisForOrder(invoiceId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('cfdis')
      .select('*')
      .contains('invoice_ids', [invoiceId])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Facturama] Error fetching CFDIs for order:', error);
      return [];
    }
    return data || [];
  }

  async createSubstitutionCfdi(
    invoice: Invoice,
    customer: Customer,
    relatedCfdiUuid: string,
    overrides?: { mealDescription?: string; deliveryDescription?: string; paymentMethod?: string; paymentForm?: string }
  ): Promise<FacturamaCfdiResponse> {
    const config = await facturamaConfigService.getFacturamaConfig();
    if (!config) throw new Error('Facturama no está configurado');

    if (!customer.rfc) throw new Error('El cliente no tiene RFC registrado');
    if (!customer.billing_name) throw new Error('El cliente no tiene razón social registrada');
    if (!customer.tax_regime) throw new Error('El cliente no tiene régimen fiscal registrado');
    if (!customer.billing_postal_code) throw new Error('El cliente no tiene código postal fiscal registrado');
    if (!config.issuer_postal_code) throw new Error('El código postal del lugar de expedición no está configurado.');

    const cfdiUse = (customer as any).cfdi_use || 'G03';
    if (!isCfdiUseCompatible(customer.tax_regime, cfdiUse)) {
      throw new Error(
        `El Uso CFDI "${cfdiUse}" no es compatible con el Régimen Fiscal "${customer.tax_regime}".`
      );
    }

    const items = this.buildItemsFromInvoice(
      invoice,
      config.default_product_key,
      config.default_unit_key,
      config.default_unit_name,
      overrides
    );

    const normalizedRfc = customer.rfc.toUpperCase().trim();
    const normalizedName = customer.billing_name.toUpperCase().trim().replace(/\s+/g, ' ');
    const normalizedRegime = customer.tax_regime.split(' ')[0].trim();
    const normalizedZip = String(customer.billing_postal_code).padStart(5, '0');

    const relations: FacturamaRelation = {
      Type: '04',
      Cfdis: [{ Uuid: relatedCfdiUuid }],
    };

    const resolvedPaymentForm = overrides?.paymentForm || '99';
    const resolvedPaymentMethod = overrides?.paymentMethod || (resolvedPaymentForm === '99' ? 'PPD' : 'PUE');

    const cfdiRequest: FacturamaCfdiRequest = {
      NameId: '1',
      CfdiType: 'I',
      Currency: 'MXN',
      PaymentForm: resolvedPaymentForm,
      PaymentMethod: resolvedPaymentMethod,
      Exportation: '01',
      ExpeditionPlace: config.issuer_postal_code,
      Relations: relations,
      Receiver: {
        Rfc: normalizedRfc,
        Name: normalizedName,
        CfdiUse: cfdiUse,
        FiscalRegime: normalizedRegime,
        TaxZipCode: normalizedZip,
      },
      Items: items,
    };

    this.logCfdiPayload('CFDI Sustitución', cfdiRequest);

    const response = await this.makeRequest<FacturamaCfdiResponse>('/3/cfdis', 'POST', cfdiRequest);

    if ((response as any).success === false) {
      throw new Error((response as any).msj || 'Error al crear el CFDI de sustitución en Facturama');
    }

    const cfdiUuid = response.Complement?.TaxStamp?.Uuid || null;
    const cfdiStatus = response.Status || 'active';

    // Update the invoice record to point to the new CFDI
    await supabase
      .from('invoices')
      .update({
        facturama_cfdi_id: response.Id,
        facturama_cfdi_uuid: cfdiUuid,
        facturama_cfdi_status: cfdiStatus,
        facturama_cfdi_created_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    // Record in audit log with relation info
    const subtotal = items.reduce((sum, item) => sum + (item.Subtotal || 0), 0);
    const discount = items.reduce((sum, item) => sum + (item.Discount || 0), 0);
    const taxAmount = items.reduce((sum, item) => {
      return sum + (item.Taxes || []).reduce((t, tx) => t + (tx.Total || 0), 0);
    }, 0);
    const totalAmount = items.reduce((sum, item) => sum + (item.Total || 0), 0);

    await supabase.from('cfdis').insert({
      facturama_cfdi_id: response.Id,
      cfdi_uuid: cfdiUuid,
      cfdi_status: cfdiStatus,
      cfdi_date: response.Date ? new Date(response.Date).toISOString() : new Date().toISOString(),
      invoice_ids: [invoice.id],
      invoice_numbers: [invoice.invoice_number],
      customer_id: customer.customer_id,
      customer_name: `${customer.customer_name} ${customer.customer_lastname}`.trim(),
      customer_rfc: normalizedRfc,
      customer_billing_name: normalizedName,
      customer_tax_regime: customer.tax_regime || null,
      customer_cfdi_use: cfdiUse,
      issuer_rfc: config.issuer_rfc,
      issuer_name: config.issuer_name,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_amount: parseFloat(discount.toFixed(2)),
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      total_amount: parseFloat(totalAmount.toFixed(2)),
      payment_form: resolvedPaymentForm,
      payment_method: resolvedPaymentMethod,
      currency: 'MXN',
      related_cfdi_uuid: relatedCfdiUuid,
      relation_type: '04',
    });

    return response;
  }

  async cancelCfdiWithSubstitution(
    originalCfdiId: string,
    invoiceId: string,
    newCfdiUuid: string
  ): Promise<void> {
    const endpoint = `/api-lite/cfdis/${originalCfdiId}?motive=01&uuidReplacement=${newCfdiUuid}`;
    await this.makeRequest(endpoint, 'DELETE');

    await supabase
      .from('invoices')
      .update({ facturama_cfdi_status: 'cancelled' })
      .eq('id', invoiceId)
      .eq('facturama_cfdi_id', originalCfdiId);

    await supabase
      .from('cfdis')
      .update({
        cfdi_status: 'cancelled',
        cancellation_motive: '01',
        updated_at: new Date().toISOString(),
      })
      .eq('facturama_cfdi_id', originalCfdiId);
  }

  async sendCfdiByEmail(
    cfdiId: string,
    recipientEmail: string,
    invoice: Invoice
  ): Promise<void> {
    const pdfBlob = await this.downloadCfdiPdf(cfdiId);
    const xmlText = await this.downloadCfdiXml(cfdiId);

    const uuid = invoice.facturama_cfdi_uuid || cfdiId;
    const invoiceNumber = invoice.invoice_number;

    const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);padding:48px 32px;text-align:center;">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;">Factura Electr&oacute;nica (CFDI)</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);">Hola Dieta &mdash; Tu comprobante fiscal</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
              Adjunto encontrar&aacute;s tu CFDI 4.0 correspondiente al ticket <strong style="color:#111827;">#${invoiceNumber}</strong>.
            </p>
            <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:24px 0;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">Folio Fiscal (UUID)</p>
              <p style="margin:0;font-size:13px;font-family:'Courier New',monospace;color:#065f46;word-break:break-all;">${uuid}</p>
            </div>
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
              Se adjuntan los archivos PDF y XML de tu comprobante. Gu&aacute;rdalos para tus registros fiscales.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">Hola Dieta</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} Hola Dieta. Todos los derechos reservados.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await mailgunService.sendEmail({
      to: recipientEmail,
      subject: `CFDI Factura Electrónica - Ticket #${invoiceNumber}`,
      html: htmlBody,
      attachments: [
        {
          filename: `CFDI-${invoiceNumber}.pdf`,
          data: pdfBlob,
          contentType: 'application/pdf',
        },
        {
          filename: `CFDI-${invoiceNumber}.xml`,
          data: xmlText,
          contentType: 'application/xml',
        },
      ],
    });
  }

  async fetchIssuerFromApi(): Promise<{
    rfc: string;
    name: string;
    taxRegime: string;
    csdName?: string;
    csdRfc?: string;
    nameMismatch?: boolean;
    rawTaxEntity?: any;
    rawCsd?: any;
  } | null> {
    const config = await facturamaConfigService.getFacturamaConfig();
    if (!config || !config.username || !config.password) {
      throw new Error('Configure las credenciales de Facturama antes de consultar');
    }

    const baseUrl = facturamaConfigService.getBaseUrl(config.environment);
    const auth = await this.getAuthHeader();

    const taxEntityResponse = await fetch(`${baseUrl}/TaxEntity`, {
      headers: { 'Authorization': auth },
    });

    if (!taxEntityResponse.ok) {
      throw new Error(`Error al consultar Facturama: ${taxEntityResponse.status} ${taxEntityResponse.statusText}`);
    }

    const entity = await taxEntityResponse.json();
    if (!entity) return null;

    const profileName: string = entity.TaxName || entity.taxName || entity.RazonSocial || entity.razonSocial || entity.Name || entity.name || '';
    const profileRfc: string = entity.Rfc || entity.rfc || '';
    const taxRegime: string = entity.FiscalRegime || entity.fiscalRegime || entity.RegimenFiscal || entity.regimenFiscal || '';

    let csdName: string | undefined;
    let csdRfc: string | undefined;
    let rawCsd: any;

    try {
      const csdsResponse = await fetch(`${baseUrl}/api/csds`, {
        headers: { 'Authorization': auth },
      });
      if (csdsResponse.ok) {
        const csds = await csdsResponse.json();
        rawCsd = csds;
        const firstCsd = Array.isArray(csds) ? csds[0] : csds;
        if (firstCsd) {
          csdName = firstCsd.TaxName || firstCsd.taxName || firstCsd.RazonSocial || firstCsd.razonSocial || firstCsd.Name || firstCsd.name || '';
          csdRfc = firstCsd.Rfc || firstCsd.rfc || '';
        }
      }
    } catch {
      // CSD fetch is best-effort
    }

    const nameMismatch = !!(csdName && profileName && csdName.trim().toUpperCase() !== profileName.trim().toUpperCase());

    return {
      rfc: profileRfc,
      name: profileName,
      taxRegime,
      csdName,
      csdRfc,
      nameMismatch,
      rawTaxEntity: entity,
      rawCsd,
    };
  }

  async createGlobalCfdi(
    invoices: Invoice[],
    month: string,
    year: string,
    paymentForm: string
  ): Promise<FacturamaCfdiResponse> {
    const config = await facturamaConfigService.getFacturamaConfig();
    if (!config) throw new Error('Facturama no está configurado');
    if (!config.issuer_postal_code) throw new Error('El código postal del lugar de expedición no está configurado.');

    if (invoices.length === 0) throw new Error('No hay facturas seleccionadas');

    const items = this.buildItemsFromInvoices(
      invoices,
      config.default_product_key,
      config.default_unit_key,
      config.default_unit_name
    );

    const cfdiRequest: FacturamaCfdiRequest = {
      NameId: '1',
      CfdiType: 'I',
      Currency: 'MXN',
      PaymentForm: paymentForm,
      PaymentMethod: 'PUE',
      Exportation: '01',
      ExpeditionPlace: config.issuer_postal_code,
      GlobalInformation: {
        Periodicity: '04',
        Months: month.padStart(2, '0'),
        Year: year,
      },
      Receiver: {
        Rfc: 'XAXX010101000',
        Name: 'PUBLICO EN GENERAL',
        CfdiUse: 'S01',
        FiscalRegime: '616',
        TaxZipCode: config.issuer_postal_code,
      },
      Items: items,
    };

    this.logCfdiPayload('CFDI Global / Público en General', cfdiRequest);

    const response = await this.makeRequest<FacturamaCfdiResponse>('/3/cfdis', 'POST', cfdiRequest);

    if ((response as any).success === false) {
      throw new Error((response as any).msj || 'Error al crear el CFDI Global en Facturama');
    }

    const cfdiUuid = response.Complement?.TaxStamp?.Uuid || null;
    const cfdiStatus = response.Status || 'active';

    // Mark all included invoices with the global CFDI reference
    for (const invoice of invoices) {
      await supabase
        .from('invoices')
        .update({
          facturama_cfdi_id: response.Id,
          facturama_cfdi_uuid: cfdiUuid,
          facturama_cfdi_status: 'global',
          facturama_cfdi_created_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);
    }

    // Record in audit log
    const subtotal = items.reduce((sum, item) => sum + (item.Subtotal || 0), 0);
    const discount = items.reduce((sum, item) => sum + (item.Discount || 0), 0);
    const taxAmount = items.reduce((sum, item) => {
      return sum + (item.Taxes || []).reduce((t, tx) => t + (tx.Total || 0), 0);
    }, 0);
    const totalAmount = items.reduce((sum, item) => sum + (item.Total || 0), 0);

    await supabase.from('cfdis').insert({
      facturama_cfdi_id: response.Id,
      cfdi_uuid: cfdiUuid,
      cfdi_status: cfdiStatus,
      cfdi_date: response.Date ? new Date(response.Date).toISOString() : new Date().toISOString(),
      invoice_ids: invoices.map(inv => inv.id),
      invoice_numbers: invoices.map(inv => inv.invoice_number),
      customer_id: null,
      customer_name: 'PUBLICO EN GENERAL',
      customer_rfc: 'XAXX010101000',
      customer_billing_name: 'PUBLICO EN GENERAL',
      customer_tax_regime: '616',
      customer_cfdi_use: 'S01',
      issuer_rfc: config.issuer_rfc,
      issuer_name: config.issuer_name,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_amount: parseFloat(discount.toFixed(2)),
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      total_amount: parseFloat(totalAmount.toFixed(2)),
      payment_form: paymentForm,
      payment_method: 'PUE',
      currency: 'MXN',
    });

    return response;
  }

  async testConnection(): Promise<void> {
    const config = await facturamaConfigService.getFacturamaConfig();
    if (!config || !config.username || !config.password) {
      throw new Error('Configure las credenciales de Facturama antes de probar la conexión');
    }

    const baseUrl = facturamaConfigService.getBaseUrl(config.environment);
    const auth = await this.getAuthHeader();

    const response = await fetch(`${baseUrl}/api/csds`, {
      headers: { 'Authorization': auth },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Error de autenticación: ${response.status} ${response.statusText}`);
    }
  }
}

export const facturamaService = new FacturamaService();
