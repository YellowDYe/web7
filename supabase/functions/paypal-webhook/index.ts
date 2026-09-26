import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PayPalWebhookEvent {
  id: string
  create_time: string
  resource_type: string
  event_type: string
  summary: string
  resource: {
    invoice?: {
      id: string
      status: string
      detail: {
        invoice_number: string
        reference?: string
        currency_code: string
        note?: string
        memo?: string
        invoice_date?: string
        payment_term?: {
          term_type?: string
          due_date?: string
        }
      }
      amount?: {
        currency_code: string
        value: string
      }
      due_amount?: {
        currency_code: string
        value: string
      }
      payments?: {
        paid_amount?: {
          currency_code: string
          value: string
        }
      }
    }
  }
  links: Array<{
    href: string
    rel: string
    method: string
  }>
}

/**
 * Asks PayPal whether this delivery really came from PayPal.
 *
 * This endpoint is deliberately unauthenticated so PayPal can reach it, which
 * means the transmission signature is the only evidence that the payload is
 * genuine. Without this check anyone could post an "invoice paid" event.
 */
async function verifyPayPalSignature(
  supabase: any,
  req: Request,
  rawBody: string,
): Promise<boolean> {
  const transmissionId = req.headers.get('paypal-transmission-id')
  const transmissionTime = req.headers.get('paypal-transmission-time')
  const transmissionSig = req.headers.get('paypal-transmission-sig')
  const certUrl = req.headers.get('paypal-cert-url')
  const authAlgo = req.headers.get('paypal-auth-algo')

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    console.error('[PayPal Webhook] Missing transmission headers')
    return false
  }

  // PayPal only serves its signing certificates from its own domains.
  let certHost: string
  try {
    certHost = new URL(certUrl).hostname
  } catch {
    return false
  }
  if (!/(^|\.)paypal\.com$/i.test(certHost)) {
    console.error('[PayPal Webhook] Certificate URL is not a PayPal host')
    return false
  }

  const { data: config } = await supabase
    .from('paypal_config')
    .select('client_id, client_secret, base_url, webhook_id')
    .eq('is_active', true)
    .maybeSingle()

  const webhookId = config?.webhook_id || Deno.env.get('PAYPAL_WEBHOOK_ID')
  const baseUrl = (config?.base_url || 'https://api-m.paypal.com').replace(/\/$/, '')

  if (!config?.client_id || !config?.client_secret || !webhookId) {
    console.error('[PayPal Webhook] PayPal credentials or webhook id not configured')
    return false
  }

  const basic = btoa(`${config.client_id}:${config.client_secret}`)

  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!tokenRes.ok) {
    console.error('[PayPal Webhook] Could not obtain a PayPal access token')
    return false
  }
  const { access_token } = await tokenRes.json()

  const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    // webhook_event must be the parsed body; PayPal re-serialises it its own way.
    body: `{"auth_algo":${JSON.stringify(authAlgo)},"cert_url":${JSON.stringify(certUrl)},` +
      `"transmission_id":${JSON.stringify(transmissionId)},` +
      `"transmission_sig":${JSON.stringify(transmissionSig)},` +
      `"transmission_time":${JSON.stringify(transmissionTime)},` +
      `"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${rawBody}}`,
  })

  if (!verifyRes.ok) {
    console.error('[PayPal Webhook] Verification request failed:', verifyRes.status)
    return false
  }

  const verification = await verifyRes.json()
  return verification?.verification_status === 'SUCCESS'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[PayPal Webhook] ===== INCOMING WEBHOOK =====')
    console.log('[PayPal Webhook] Method:', req.method)

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.text()
    console.log('[PayPal Webhook] Raw body received')

    let event: PayPalWebhookEvent
    try {
      event = JSON.parse(body)
    } catch (parseError) {
      console.error('[PayPal Webhook] Failed to parse JSON:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[PayPal Webhook] Event type:', event.event_type)
    console.log('[PayPal Webhook] Event ID:', event.id)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Nothing below this point may run on an unverified payload: the handlers
    // mark invoices as paid using service-role rights.
    if (!(await verifyPayPalSignature(supabase, req, body))) {
      console.error('[PayPal Webhook] Signature verification failed; rejecting event')
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process different event types
    switch (event.event_type) {
      case 'INVOICING.INVOICE.CREATED':
        await handleInvoiceCreated(supabase, event)
        break
      
      case 'INVOICING.INVOICE.PAID':
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handleInvoicePaid(supabase, event)
        break
      
      case 'INVOICING.INVOICE.CANCELLED':
        await handleInvoiceCancelled(supabase, event)
        break
      
      case 'INVOICING.INVOICE.REFUNDED':
        await handleInvoiceRefunded(supabase, event)
        break
      
      case 'INVOICING.INVOICE.UPDATED':
        await handleInvoiceUpdated(supabase, event)
        break
      
      default:
        console.log(`[PayPal Webhook] Unhandled event type: ${event.event_type}`)
    }

    // Log the webhook event
    await supabase.from('paypal_webhook_logs').insert({
      event_id: event.id,
      event_type: event.event_type,
      event_data: event,
      processed_at: new Date().toISOString(),
      status: 'success'
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[PayPal Webhook] Error processing webhook:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleInvoiceCreated(supabase: any, event: PayPalWebhookEvent) {
  console.log('[PayPal Webhook] Handling INVOICE.CREATED')
  
  const invoice = event.resource.invoice
  if (!invoice) {
    console.error('[PayPal Webhook] No invoice data in event')
    return
  }

  console.log('[PayPal Webhook] Invoice ID:', invoice.id)
  console.log('[PayPal Webhook] Invoice Number:', invoice.detail.invoice_number)
  console.log('[PayPal Webhook] Status:', invoice.status)

  // Find the invoice in our database by PayPal invoice ID or invoice number
  const { data: existingInvoice, error: findError } = await supabase
    .from('invoices')
    .select('*')
    .or(`paypal_invoice_id.eq.${invoice.id},invoice_number.eq.${invoice.detail.invoice_number}`)
    .maybeSingle()

  if (findError) {
    console.error('[PayPal Webhook] Error finding invoice:', findError)
    return
  }

  if (existingInvoice) {
    console.log('[PayPal Webhook] Found existing invoice:', existingInvoice.id)
    
    // Update the invoice with PayPal data
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        paypal_invoice_id: invoice.id,
        paypal_invoice_status: invoice.status.toLowerCase(),
        paypal_invoice_number: invoice.detail.invoice_number,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingInvoice.id)

    if (updateError) {
      console.error('[PayPal Webhook] Error updating invoice:', updateError)
    } else {
      console.log('[PayPal Webhook] Successfully updated invoice')
    }
  } else {
    console.log('[PayPal Webhook] No matching invoice found in database')
  }
}

async function handleInvoicePaid(supabase: any, event: PayPalWebhookEvent) {
  console.log('[PayPal Webhook] Handling INVOICE.PAID or PAYMENT.CAPTURE.COMPLETED')

  const invoice = event.resource.invoice
  if (!invoice) {
    console.error('[PayPal Webhook] No invoice data in event')
    return
  }

  console.log('[PayPal Webhook] Invoice ID:', invoice.id)
  console.log('[PayPal Webhook] Status:', invoice.status)

  // Find and update the invoice
  const { data: existingInvoice, error: findError } = await supabase
    .from('invoices')
    .select('*')
    .eq('paypal_invoice_id', invoice.id)
    .maybeSingle()

  if (findError) {
    console.error('[PayPal Webhook] Error finding invoice:', findError)
    return
  }

  if (existingInvoice) {
    console.log('[PayPal Webhook] Found invoice:', existingInvoice.id)

    // Update PayPal invoice status - the database trigger will automatically sync invoice_status
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        paypal_invoice_status: invoice.status.toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingInvoice.id)

    if (updateError) {
      console.error('[PayPal Webhook] Error updating invoice:', updateError)
      return
    }

    console.log('[PayPal Webhook] Successfully updated invoice - status will be synced by trigger')

    // Update associated order status if not a manual invoice
    if (existingInvoice.order_id && !existingInvoice.order_id.startsWith('MANUAL-')) {
      console.log('[PayPal Webhook] Updating order status for:', existingInvoice.order_id)

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', existingInvoice.order_id)
        .maybeSingle()

      if (!orderError && order) {
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            order_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)

        if (orderUpdateError) {
          console.error('[PayPal Webhook] Error updating order status:', orderUpdateError)
        } else {
          console.log('[PayPal Webhook] Successfully updated order status to completed')
        }
      }
    }
  } else {
    console.log('[PayPal Webhook] No matching invoice found')
  }
}

async function handleInvoiceCancelled(supabase: any, event: PayPalWebhookEvent) {
  console.log('[PayPal Webhook] Handling INVOICE.CANCELLED')

  const invoice = event.resource.invoice
  if (!invoice) {
    console.error('[PayPal Webhook] No invoice data in event')
    return
  }

  console.log('[PayPal Webhook] Invoice ID:', invoice.id)

  const { data: existingInvoice, error: findError } = await supabase
    .from('invoices')
    .select('*')
    .eq('paypal_invoice_id', invoice.id)
    .maybeSingle()

  if (findError) {
    console.error('[PayPal Webhook] Error finding invoice:', findError)
    return
  }

  if (existingInvoice) {
    console.log('[PayPal Webhook] Found invoice:', existingInvoice.id)

    // Update PayPal invoice status - the database trigger will automatically sync invoice_status
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        paypal_invoice_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', existingInvoice.id)

    if (updateError) {
      console.error('[PayPal Webhook] Error updating invoice to cancelled:', updateError)
      return
    }

    console.log('[PayPal Webhook] Successfully updated invoice - status will be synced by trigger')

    // Update associated order status if not a manual invoice
    if (existingInvoice.order_id && !existingInvoice.order_id.startsWith('MANUAL-')) {
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', existingInvoice.order_id)
        .maybeSingle()

      if (order) {
        await supabase
          .from('orders')
          .update({
            order_status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)

        console.log('[PayPal Webhook] Successfully updated order status to cancelled')
      }
    }
  } else {
    console.log('[PayPal Webhook] No matching invoice found')
  }
}

async function handleInvoiceRefunded(supabase: any, event: PayPalWebhookEvent) {
  console.log('[PayPal Webhook] Handling INVOICE.REFUNDED')

  const invoice = event.resource.invoice
  if (!invoice) {
    console.error('[PayPal Webhook] No invoice data in event')
    return
  }

  console.log('[PayPal Webhook] Invoice ID:', invoice.id)

  // Update PayPal invoice status - the database trigger will keep invoice_status as draft for refunded status
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      paypal_invoice_status: 'refunded',
      updated_at: new Date().toISOString()
    })
    .eq('paypal_invoice_id', invoice.id)

  if (updateError) {
    console.error('[PayPal Webhook] Error updating invoice to refunded:', updateError)
  } else {
    console.log('[PayPal Webhook] Successfully updated invoice - status will be synced by trigger')
  }
}

async function handleInvoiceUpdated(supabase: any, event: PayPalWebhookEvent) {
  console.log('[PayPal Webhook] Handling INVOICE.UPDATED')

  const invoice = event.resource.invoice
  if (!invoice) {
    console.error('[PayPal Webhook] No invoice data in event')
    return
  }

  console.log('[PayPal Webhook] Invoice ID:', invoice.id)
  console.log('[PayPal Webhook] New status:', invoice.status)

  // Update PayPal invoice status - the database trigger will automatically sync invoice_status
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      paypal_invoice_status: invoice.status.toLowerCase(),
      updated_at: new Date().toISOString()
    })
    .eq('paypal_invoice_id', invoice.id)

  if (updateError) {
    console.error('[PayPal Webhook] Error updating invoice:', updateError)
  } else {
    console.log('[PayPal Webhook] Successfully updated invoice - status will be synced by trigger')
  }
}
