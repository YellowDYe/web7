import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  UserCheck,
  ShoppingBag,
  ShoppingCart,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  dashboardService,
  DashboardData,
  DashboardRange,
} from '../../services/dashboardService';

const RANGE_OPTIONS: { id: DashboardRange; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
];

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconBg: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon: Icon, accent, iconBg }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition-all duration-200 hover:shadow-md">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${accent}`}>{value.toLocaleString('es-MX')}</p>
      </div>
      <div className={`p-3 rounded-xl ${iconBg}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [range, setRange] = useState<DashboardRange>('30d');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (selected: DashboardRange) => {
    try {
      setLoading(true);
      setError(false);
      const result = await dashboardService.getDashboardData(selected);
      setData(result);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-primary-100 p-2 rounded-lg">
            <TrendingUp className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Resumen</h2>
            <p className="text-sm text-gray-600">Actividad reciente de tu sitio</p>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setRange(opt.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                range === opt.id
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-600 mb-4">No pudimos cargar la información en este momento.</p>
          <button
            onClick={() => load(range)}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Intentar de nuevo</span>
          </button>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Nuevos clientes"
              value={data.metrics.newCustomers}
              icon={Users}
              accent="text-blue-600"
              iconBg="bg-blue-50 text-blue-600"
            />
            <MetricCard
              label="Clientes activos"
              value={data.metrics.activeCustomers}
              icon={UserCheck}
              accent="text-emerald-600"
              iconBg="bg-emerald-50 text-emerald-600"
            />
            <MetricCard
              label="Nuevos pedidos"
              value={data.metrics.newOrders}
              icon={ShoppingBag}
              accent="text-primary-600"
              iconBg="bg-primary-50 text-primary-600"
            />
            <MetricCard
              label="Carritos abandonados"
              value={data.metrics.abandonedCarts}
              icon={ShoppingCart}
              accent="text-amber-600"
              iconBg="bg-amber-50 text-amber-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Últimos registros</h3>
              </div>
              {data.recentSignups.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Aún no hay registros.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.recentSignups.map((s) => (
                    <li key={s.id} className="py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500 truncate">{s.email}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-3">
                        {formatDate(s.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center space-x-2 mb-4">
                <ShoppingBag className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Últimos pedidos</h3>
              </div>
              {data.recentOrders.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Aún no hay pedidos.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.recentOrders.map((o) => (
                    <li key={o.orderId} className="py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">#{o.orderId}</p>
                        {o.status && (
                          <p className="text-xs text-gray-500 capitalize">{o.status}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-3">
                        {formatDate(o.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Dashboard;
