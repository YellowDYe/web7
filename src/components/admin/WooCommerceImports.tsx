import React, { useState, useEffect } from 'react';
import {
  ClipboardList, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  CircleCheck as CheckCircle, CircleAlert as AlertCircle,
  Loader as Loader2, RefreshCw, Eye, Download, CreditCard, Receipt,
} from 'lucide-react';
import {
  woocommerceConfigService,
  WooCommerceConfigForm,
  WooCommerceOrderImport,
  WooCommerceProductMapping,
  WooCommerceShippingMapping,
  WooCommercePaymentMapping,
} from '../../services/woocommerceConfigService';
import { mealPlanService } from '../../services/mealPlanService';
import { deliveryOptionService } from '../../services/deliveryOptionService';
import { bankAccountService } from '../../services/bankAccountService';
import { MealPlan } from '../../types/mealPlan';
import { DeliveryOption } from '../../types/deliveryOption';
import { BankAccount } from '../../types/bankAccount';
import WooCommerceReviewModal from './WooCommerceReviewModal';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_review: { label: 'Pendiente revisión', color: 'bg-amber-100 text-amber-700' },
  approved:       { label: 'Aprobado',           color: 'bg-green-100 text-green-700' },
  failed:         { label: 'Error',              color: 'bg-red-100 text-red-700' },
  duplicate:      { label: 'Duplicado',          color: 'bg-gray-100 text-gray-600' },
  test:           { label: 'Modo prueba',        color: 'bg-blue-100 text-blue-700' },
  test_processed: { label: 'Prueba procesada',   color: 'bg-teal-100 text-teal-700' },
};

const IMPORTS_PAGE_SIZE = 20;

const WooCommerceImports: React.FC = () => {
  // Config (needed for test_mode toggle + API fetch button)
  const [configForm, setConfigForm] = useState<WooCommerceConfigForm>({
    store_url: '', consumer_key: '', consumer_secret: '', webhook_secret: '',
    cutoff_day: 5, cutoff_hour: 12, test_mode: false,
  });

  // Imports
  const [imports, setImports] = useState<WooCommerceOrderImport[]>([]);
  const [importsLoading, setImportsLoading] = useState(false);
  const [importsError, setImportsError] = useState<string | null>(null);
  const [expandedImportId, setExpandedImportId] = useState<string | null>(null);
  const [importsPage, setImportsPage] = useState(1);

  // Review modal
  const [reviewModalImport, setReviewModalImport] = useState<WooCommerceOrderImport | null>(null);
  const [reviewSuccessResults, setReviewSuccessResults] = useState<Record<string, string>>({});

  // Test mode toggle
  const [testModeToggling, setTestModeToggling] = useState(false);
  const [testModeError, setTestModeError] = useState<string | null>(null);

  // API fetch
  const [fetchingFromApi, setFetchingFromApi] = useState(false);
  const [fetchApiResult, setFetchApiResult] = useState<{ fetched: number; new: number; duplicates: number } | null>(null);
  const [fetchApiError, setFetchApiError] = useState<string | null>(null);

  // Data needed by the review modal
  const [productMappings, setProductMappings] = useState<WooCommerceProductMapping[]>([]);
  const [shippingMappings, setShippingMappings] = useState<WooCommerceShippingMapping[]>([]);
  const [paymentMappings, setPaymentMappings] = useState<WooCommercePaymentMapping[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([
      loadConfig(),
      loadImports(),
      loadMappings(),
      loadShippingMappings(),
      loadPaymentMappings(),
    ]);
  };

  const loadConfig = async () => {
    try {
      const form = await woocommerceConfigService.getConfigForm();
      setConfigForm(form);
    } catch {}
  };

  const loadImports = async () => {
    try {
      setImportsLoading(true);
      setImportsError(null);
      const data = await woocommerceConfigService.getOrderImports();
      setImports(data);
      setImportsPage(1);
    } catch {
      setImportsError('Error al cargar las importaciones');
    } finally {
      setImportsLoading(false);
    }
  };

  const loadMappings = async () => {
    try {
      const [m, mp, dos] = await Promise.all([
        woocommerceConfigService.getMappings(),
        mealPlanService.getPlans(),
        deliveryOptionService.getOptions(),
      ]);
      setProductMappings(m);
      setMealPlans(mp);
      setDeliveryOptions(dos);
    } catch {}
  };

  const loadShippingMappings = async () => {
    try {
      setShippingLoading(true);
      setShippingMappings(await woocommerceConfigService.getShippingMappings());
    } catch {} finally {
      setShippingLoading(false);
    }
  };

  const loadPaymentMappings = async () => {
    try {
      const [pm, ba] = await Promise.all([
        woocommerceConfigService.getPaymentMappings(),
        bankAccountService.getAccounts(),
      ]);
      setPaymentMappings(pm);
      setBankAccounts(ba);
    } catch {}
  };

  const handleToggleTestMode = async () => {
    const newValue = !configForm.test_mode;
    setTestModeToggling(true);
    setTestModeError(null);
    setConfigForm(p => ({ ...p, test_mode: newValue }));
    try {
      await woocommerceConfigService.saveConfig({ ...configForm, test_mode: newValue });
      woocommerceConfigService.clearCache();
    } catch {
      setConfigForm(p => ({ ...p, test_mode: !newValue }));
      setTestModeError('Error al guardar el modo de prueba. Intenta de nuevo.');
    } finally {
      setTestModeToggling(false);
    }
  };

  const handleFetchFromApi = async () => {
    setFetchingFromApi(true);
    setFetchApiError(null);
    setFetchApiResult(null);
    try {
      const result = await woocommerceConfigService.fetchOrdersFromApi({ perPage: 25, status: 'processing' });
      setFetchApiResult(result);
      await loadImports();
    } catch (err) {
      setFetchApiError(err instanceof Error ? err.message : 'Error al importar pedidos');
    } finally {
      setFetchingFromApi(false);
    }
  };

  const handleOpenReview = async (imp: WooCommerceOrderImport) => {
    if (shippingMappings.length === 0 && !shippingLoading) {
      await loadShippingMappings();
    }
    setReviewModalImport(imp);
  };

  const handleReviewSuccess = async (importId: string, appOrderId: string) => {
    setReviewSuccessResults(prev => ({ ...prev, [importId]: appOrderId }));
    setReviewModalImport(null);
    await loadImports();
  };

  const fmt = (n: number | null, currency?: string | null) =>
    n != null ? `${currency ?? 'MXN'} $${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

  const totalPages = Math.ceil(imports.length / IMPORTS_PAGE_SIZE);
  const pagedImports = imports.slice((importsPage - 1) * IMPORTS_PAGE_SIZE, importsPage * IMPORTS_PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Registro de los últimos pedidos recibidos desde WooCommerce.</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleFetchFromApi}
            disabled={fetchingFromApi || !configForm.store_url || !configForm.consumer_key || !configForm.consumer_secret}
            title={!configForm.store_url || !configForm.consumer_key || !configForm.consumer_secret ? 'Configura store_url, consumer_key y consumer_secret primero' : 'Importar los últimos 25 pedidos con estado "processing" desde WooCommerce'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fetchingFromApi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Importar desde API
          </button>
          <button
            onClick={loadImports}
            disabled={importsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${importsLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* API fetch result banner */}
      {fetchApiResult && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">
              {fetchApiResult.new === 0 ? 'Sin pedidos nuevos' : `${fetchApiResult.new} pedido${fetchApiResult.new !== 1 ? 's' : ''} importado${fetchApiResult.new !== 1 ? 's' : ''}`}
            </span>
            {fetchApiResult.duplicates > 0 && (
              <span className="text-green-600"> · {fetchApiResult.duplicates} duplicado{fetchApiResult.duplicates !== 1 ? 's' : ''} omitido{fetchApiResult.duplicates !== 1 ? 's' : ''}</span>
            )}
            <span className="text-green-600"> ({fetchApiResult.fetched} pedidos consultados)</span>
          </div>
        </div>
      )}

      {/* API fetch error */}
      {fetchApiError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {fetchApiError}
        </div>
      )}

      {/* Test mode toggle */}
      <div className={`flex items-center justify-between p-3.5 rounded-xl border ${configForm.test_mode ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
        <div>
          <p className={`text-sm font-medium ${configForm.test_mode ? 'text-blue-900' : 'text-gray-700'}`}>Modo de prueba</p>
          <p className={`text-xs mt-0.5 ${configForm.test_mode ? 'text-blue-600' : 'text-gray-400'}`}>
            {configForm.test_mode ? 'Activo — los pedidos se etiquetan como prueba' : 'Inactivo — todos los pedidos requieren revisión manual antes de crearse'}
          </p>
          {testModeError && <p className="text-xs text-red-600 mt-1">{testModeError}</p>}
        </div>
        <button
          type="button"
          onClick={handleToggleTestMode}
          disabled={testModeToggling}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${configForm.test_mode ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          {testModeToggling
            ? <Loader2 className="w-3 h-3 animate-spin text-white mx-auto" />
            : <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${configForm.test_mode ? 'translate-x-4' : 'translate-x-1'}`} />
          }
        </button>
      </div>

      {/* Error */}
      {importsError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {importsError}
        </div>
      )}

      {/* List */}
      {importsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Sin importaciones registradas</p>
          <p className="text-xs text-gray-400 mt-1">Los pedidos recibidos por webhook aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pagedImports.map(imp => {
            const s = STATUS_LABELS[imp.status] ?? { label: imp.status, color: 'bg-gray-100 text-gray-600' };
            const isExpanded = expandedImportId === imp.id;
            const isTest = imp.status === 'test';
            const hasFinancial = imp.total_amount != null || imp.payment_method != null;
            const paymentLabel = paymentMappings.find(pm => pm.wc_method_id === imp.payment_method)?.internal_label
              ?? imp.payment_method_title
              ?? imp.payment_method
              ?? null;

            return (
              <div key={imp.id} className={`border rounded-xl bg-white overflow-hidden ${isTest ? 'border-blue-200' : 'border-gray-200'}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">WC #{imp.wc_order_number || imp.wc_order_id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                        {imp.app_order_id && (
                          <span className="text-xs text-gray-500">→ {imp.app_order_id}</span>
                        )}
                        {imp.total_amount != null && (
                          <span className="text-xs font-semibold text-gray-800">
                            {fmt(imp.total_amount, imp.currency)}
                          </span>
                        )}
                      </div>

                      {/* Email + payment */}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <p className="text-xs text-gray-500">{imp.customer_email}</p>
                        {paymentLabel && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <CreditCard className="w-3 h-3" />
                            {paymentLabel}
                          </span>
                        )}
                        {imp.payment_date && (
                          <span className="text-xs text-gray-400">
                            Pagado: {new Date(imp.payment_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {/* Financial summary */}
                      {hasFinancial && (
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {imp.cart_tax != null && imp.cart_tax > 0 && (
                            <span className="text-xs text-gray-400">
                              IVA{imp.tax_rate_percent != null ? ` (${imp.tax_rate_percent}%)` : ''}: {fmt(imp.cart_tax, imp.currency)}
                            </span>
                          )}
                          {imp.shipping_total != null && imp.shipping_total > 0 && (
                            <span className="text-xs text-gray-400">
                              Envío: {fmt(imp.shipping_total, imp.currency)}
                            </span>
                          )}
                          {imp.discount_total != null && imp.discount_total > 0 && (
                            <span className="text-xs text-green-600">
                              Descuento: -{fmt(imp.discount_total, imp.currency)}
                              {imp.coupon_codes && imp.coupon_codes.length > 0 && (
                                <span className="ml-1 text-green-500">({imp.coupon_codes.join(', ')})</span>
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {imp.error_message && imp.status !== 'test' && (
                        <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded-lg px-2 py-1">{imp.error_message}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {new Date(imp.imported_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {reviewSuccessResults[imp.id] ? (
                        <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg font-medium">
                          <CheckCircle className="w-3 h-3" />
                          {reviewSuccessResults[imp.id]}
                        </span>
                      ) : imp.raw_payload && imp.status !== 'approved' && imp.status !== 'duplicate' && imp.status !== 'test_processed' ? (
                        <button
                          onClick={() => handleOpenReview(imp)}
                          className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                        >
                          <Eye className="w-3 h-3" />
                          Revisar pedido
                        </button>
                      ) : null}
                      {(imp.raw_payload || imp.payment_transaction_id || imp.payment_fee != null) && (
                        <button
                          onClick={() => setExpandedImportId(isExpanded ? null : imp.id)}
                          className={`flex items-center gap-1 text-xs transition-colors ${isTest ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 hover:text-gray-700'}`}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          Detalle
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className={`border-t p-4 space-y-3 ${isTest ? 'border-blue-100 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                    {(imp.payment_transaction_id || imp.payment_fee != null || imp.wc_billing_colonia) && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5" />
                          Detalle de pago
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {imp.payment_transaction_id && (
                            <>
                              <span className="text-xs text-gray-500">ID transacción</span>
                              <code className="text-xs text-gray-700 font-mono break-all">{imp.payment_transaction_id}</code>
                            </>
                          )}
                          {imp.payment_fee != null && (
                            <>
                              <span className="text-xs text-gray-500">Comisión pasarela</span>
                              <span className="text-xs text-gray-700">{fmt(imp.payment_fee, imp.currency)}</span>
                            </>
                          )}
                          {imp.wc_billing_colonia && (
                            <>
                              <span className="text-xs text-gray-500">Colonia</span>
                              <span className="text-xs text-gray-700">{imp.wc_billing_colonia}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {isTest && imp.raw_payload && (
                      <div>
                        <p className="text-xs font-medium text-blue-700 mb-1">Payload completo</p>
                        <pre className="text-xs text-blue-900 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                          {JSON.stringify(imp.raw_payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {imports.length > IMPORTS_PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {((importsPage - 1) * IMPORTS_PAGE_SIZE) + 1}–{Math.min(importsPage * IMPORTS_PAGE_SIZE, imports.length)} de {imports.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setImportsPage(p => Math.max(1, p - 1))}
                  disabled={importsPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setImportsPage(page)}
                    className={`min-w-[28px] h-7 text-xs rounded-lg border transition-colors ${importsPage === page ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setImportsPage(p => Math.min(totalPages, p + 1))}
                  disabled={importsPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review modal */}
      {reviewModalImport && (
        <WooCommerceReviewModal
          imp={reviewModalImport}
          isTest={configForm.test_mode}
          productMappings={productMappings}
          shippingMappings={shippingMappings}
          paymentMappings={paymentMappings}
          mealPlans={mealPlans}
          deliveryOptions={deliveryOptions}
          bankAccounts={bankAccounts}
          onClose={() => setReviewModalImport(null)}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
};

export default WooCommerceImports;
