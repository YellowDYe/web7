import React, { useCallback, useEffect, useState } from 'react';
import { CircleAlert as AlertCircle, Loader as Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../config/supabase';

interface PaymentRejection {
  id: string;
  amount: number | string;
  last_error: string | null;
  last_error_code: string | null;
  last_error_at: string;
}

const MercadoPagoRecentRejections: React.FC = () => {
  const [rejections, setRejections] = useState<PaymentRejection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Inicia sesion para ver los pagos rechazados.');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercado-pago-checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get-recent-payment-errors' }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !Array.isArray(data.errors)) {
        throw new Error(data?.error || 'No se pudieron cargar los pagos rechazados.');
      }
      setRejections(data.errors);
    } catch (err: any) {
      setError(err.message || 'No se pudieron cargar los pagos rechazados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-gray-800">Ultimos pagos con tarjeta rechazados</span>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors disabled:opacity-50"
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && rejections.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
        </div>
      ) : error ? (
        <p className="px-4 py-4 text-sm text-red-600">{error}</p>
      ) : rejections.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-500">No hay pagos rechazados recientes.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rejections.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-gray-800">{r.last_error || 'Rechazado sin motivo indicado'}</p>
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  ${Number(r.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(r.last_error_at).toLocaleString('es-MX')}
                {r.last_error_code ? ` · Codigo: ${r.last_error_code}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MercadoPagoRecentRejections;
