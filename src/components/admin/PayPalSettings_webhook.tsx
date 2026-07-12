        {/* Webhook Configuration Section */}
        <div className="space-y-4 pt-6 border-t border-gray-200 mt-6">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Globe className="w-5 h-5 text-green-600" />
            </div>
            <h4 className="text-lg font-medium text-gray-900">Configuración de Webhook</h4>
          </div>
          
          <p className="text-gray-600 text-sm">
            Configure este webhook en su Dashboard de PayPal para recibir notificaciones de eventos de facturación.
          </p>

          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL del Webhook
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-mono text-sm text-gray-800 overflow-x-auto">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-webhook
              </div>
              <button
                onClick={() => {
                  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-webhook`;
                  navigator.clipboard.writeText(webhookUrl);
                  setTestResult({ type: 'success', message: 'URL copiada al portapapeles' });
                  setTimeout(() => setTestResult({ type: null, message: '' }), 2000);
                }}
                className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copiar</span>
              </button>
            </div>
          </div>

          {/* Webhook Events */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Eventos a configurar en PayPal:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• <strong>INVOICING.INVOICE.CREATED</strong> - Cuando se crea una factura</li>
                  <li>• <strong>INVOICING.INVOICE.PAID</strong> - Cuando se paga una factura</li>
                  <li>• <strong>INVOICING.INVOICE.CANCELLED</strong> - Cuando se cancela una factura</li>
                  <li>• <strong>INVOICING.INVOICE.REFUNDED</strong> - Cuando se reembolsa una factura</li>
                  <li>• <strong>INVOICING.INVOICE.UPDATED</strong> - Cuando se actualiza una factura</li>
                  <li>• <strong>PAYMENT.CAPTURE.COMPLETED</strong> - Cuando se completa un pago</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-800">
                <p className="font-medium mb-2">Cómo configurar el webhook en PayPal:</p>
                <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                  <li>Inicie sesión en su <a href="https://developer.paypal.com/dashboard/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Dashboard de PayPal</a></li>
                  <li>Navegue a "Apps & Credentials" y seleccione su aplicación</li>
                  <li>Haga clic en "Add Webhook" en la sección de Webhooks</li>
                  <li>Pegue la URL del webhook que aparece arriba</li>
                  <li>Seleccione los eventos de la lista anterior</li>
                  <li>Guarde la configuración</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
