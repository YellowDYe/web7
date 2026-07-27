import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  Power,
  X,
  Percent,
  DollarSign,
} from 'lucide-react';
import { couponService } from '../../services/couponService';
import {
  Coupon,
  CreateCouponData,
  CouponWithUsage,
} from '../../types/coupon';

type DiscountType = 'percentage' | 'fixed';

interface FormState {
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  min_purchase_amount: string;
  max_discount_amount: string;
  usage_limit: string;
  usage_limit_per_customer: string;
  valid_from: string;
  valid_until: string;
}

const emptyForm: FormState = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  min_purchase_amount: '',
  max_discount_amount: '',
  usage_limit: '',
  usage_limit_per_customer: '',
  valid_from: new Date().toISOString().slice(0, 16),
  valid_until: '',
};

const CouponsCard: React.FC = () => {
  const [coupons, setCoupons] = useState<CouponWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await couponService.getAllCoupons();
      const withUsage = await Promise.all(
        data.map(async (c) => {
          const usage_count = await couponService.getCouponTotalUsage(c.id);
          return { ...c, usage_count } as CouponWithUsage;
        })
      );
      setCoupons(withUsage);
    } catch (err) {
      setError('Error al cargar los cupones');
      console.error('Error loading coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};

    if (!form.code.trim()) {
      errs.code = 'El código es obligatorio';
    }
    if (!form.discount_value.trim()) {
      errs.discount_value = 'El valor del descuento es obligatorio';
    } else {
      const value = parseFloat(form.discount_value);
      if (isNaN(value) || value <= 0) {
        errs.discount_value = 'El valor debe ser mayor a 0';
      } else if (form.discount_type === 'percentage' && value > 100) {
        errs.discount_value = 'El porcentaje no puede ser mayor a 100';
      }
    }
    if (form.min_purchase_amount) {
      const v = parseFloat(form.min_purchase_amount);
      if (isNaN(v) || v < 0) errs.min_purchase_amount = 'Debe ser un número válido';
    }
    if (form.max_discount_amount) {
      const v = parseFloat(form.max_discount_amount);
      if (isNaN(v) || v < 0) errs.max_discount_amount = 'Debe ser un número válido';
    }
    if (form.usage_limit) {
      const v = parseInt(form.usage_limit, 10);
      if (isNaN(v) || v <= 0) errs.usage_limit = 'Debe ser mayor a 0';
    }
    if (form.usage_limit_per_customer) {
      const v = parseInt(form.usage_limit_per_customer, 10);
      if (isNaN(v) || v <= 0) errs.usage_limit_per_customer = 'Debe ser mayor a 0';
    }
    if (!form.valid_from) {
      errs.valid_from = 'La fecha de inicio es obligatoria';
    }
    if (form.valid_until && form.valid_from && new Date(form.valid_until) < new Date(form.valid_from)) {
      errs.valid_until = 'La fecha de fin debe ser posterior al inicio';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      const payload: CreateCouponData = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_purchase_amount: form.min_purchase_amount ? parseFloat(form.min_purchase_amount) : undefined,
        max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : undefined,
        usage_limit: form.usage_limit ? parseInt(form.usage_limit, 10) : undefined,
        usage_limit_per_customer: form.usage_limit_per_customer
          ? parseInt(form.usage_limit_per_customer, 10)
          : undefined,
        valid_from: new Date(form.valid_from).toISOString(),
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : undefined,
        is_active: true,
      };
      await couponService.createCoupon(payload);
      setForm(emptyForm);
      setFormErrors({});
      setIsFormOpen(false);
      await loadCoupons();
    } catch (err: any) {
      setFormErrors({ code: err?.message || 'Error al crear el cupón' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      setActionLoadingId(coupon.id);
      await couponService.updateCoupon(coupon.id, { is_active: !coupon.is_active });
      await loadCoupons();
    } catch (err) {
      setError('Error al actualizar el cupón');
      console.error('Error toggling coupon:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!couponToDelete) return;
    try {
      setActionLoadingId(couponToDelete.id);
      await couponService.deleteCoupon(couponToDelete.id);
      setCouponToDelete(null);
      await loadCoupons();
    } catch (err) {
      setError('Error al eliminar el cupón');
      console.error('Error deleting coupon:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (d: string | null): string => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatValue = (c: Coupon): string => {
    return c.discount_type === 'percentage'
      ? `${c.discount_value}%`
      : `$${Number(c.discount_value).toFixed(2)}`;
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) {
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
      {/* Card Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-100 p-2 rounded-lg">
              <Ticket className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-poppins">Cupones</h2>
              <p className="text-sm text-gray-500">Códigos de descuento</p>
            </div>
          </div>
          <button
            onClick={() => {
              setForm(emptyForm);
              setFormErrors({});
              setIsFormOpen(true);
            }}
            className="bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-lg transition-colors"
            aria-label="Nuevo cupón"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 flex-1">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2 mb-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-gray-600 text-sm">Cargando cupones...</span>
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-8">
            <Ticket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">No hay cupones creados</p>
            <button
              onClick={() => setIsFormOpen(true)}
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              Crear el primer cupón
            </button>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {coupons.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border p-4 transition-colors ${
                  c.is_active
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-200 bg-gray-50 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-gray-900 truncate">
                        {c.code}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {c.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-sm text-gray-500 truncate mb-1">{c.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        {c.discount_type === 'percentage' ? (
                          <Percent className="w-3 h-3" />
                        ) : (
                          <DollarSign className="w-3 h-3" />
                        )}
                        {formatValue(c)}
                      </span>
                      <span>Usos: {c.usage_count ?? 0}{c.usage_limit ? `/${c.usage_limit}` : ''}</span>
                      <span>
                        {formatDate(c.valid_from)} — {formatDate(c.valid_until)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(c)}
                      disabled={actionLoadingId === c.id}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50"
                      aria-label={c.is_active ? 'Desactivar' : 'Activar'}
                      title={c.is_active ? 'Desactivar' : 'Activar'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCouponToDelete(c)}
                      disabled={actionLoadingId === c.id}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      aria-label="Eliminar"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center space-x-3">
                <div className="bg-primary-100 p-2 rounded-lg">
                  <Ticket className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 font-poppins">Nuevo Cupón</h2>
                  <p className="text-sm text-gray-500">Crea un nuevo cupón de descuento</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setFormErrors({});
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Cerrar"
                disabled={submitting}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Código */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código del Cupón <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => update('code', e.target.value.toUpperCase())}
                  className={`w-full px-4 py-2.5 rounded-xl border ${
                    formErrors.code ? 'border-red-400' : 'border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono uppercase`}
                  placeholder="VERANO2026"
                />
                {formErrors.code && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.code}</p>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Descuento de temporada"
                />
              </div>

              {/* Tipo de Descuento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Descuento <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['percentage', 'fixed'] as DiscountType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update('discount_type', t)}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-medium transition-colors ${
                        form.discount_type === t
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t === 'percentage' ? (
                        <>
                          <Percent className="w-4 h-4" />
                          Porcentaje
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4" />
                          Monto Fijo
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor del Descuento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor del Descuento <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {form.discount_type === 'percentage' ? '%' : '$'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.discount_value}
                    onChange={(e) => update('discount_value', e.target.value)}
                    className={`w-full pl-8 pr-4 py-2.5 rounded-xl border ${
                      formErrors.discount_value ? 'border-red-400' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                    placeholder={form.discount_type === 'percentage' ? '10' : '50.00'}
                  />
                </div>
                {formErrors.discount_value && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.discount_value}</p>
                )}
              </div>

              {/* Compra Mínima & Descuento Máximo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Compra Mínima
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.min_purchase_amount}
                    onChange={(e) => update('min_purchase_amount', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.min_purchase_amount ? 'border-red-400' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                    placeholder="0.00"
                  />
                  {formErrors.min_purchase_amount && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.min_purchase_amount}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descuento Máximo
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.max_discount_amount}
                    onChange={(e) => update('max_discount_amount', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.max_discount_amount ? 'border-red-400' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                    placeholder="0.00"
                  />
                  {formErrors.max_discount_amount && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.max_discount_amount}</p>
                  )}
                </div>
              </div>

              {/* Límites */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Límite de Uso Total
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.usage_limit}
                    onChange={(e) => update('usage_limit', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.usage_limit ? 'border-red-400' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                    placeholder="Sin límite"
                  />
                  {formErrors.usage_limit && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.usage_limit}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Límite por Cliente
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.usage_limit_per_customer}
                    onChange={(e) => update('usage_limit_per_customer', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.usage_limit_per_customer ? 'border-red-400' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                    placeholder="Sin límite"
                  />
                  {formErrors.usage_limit_per_customer && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.usage_limit_per_customer}</p>
                  )}
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Válido Desde <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={(e) => update('valid_from', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.valid_from ? 'border-red-400' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                  />
                  {formErrors.valid_from && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.valid_from}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Válido Hasta
                  </label>
                  <input
                    type="datetime-local"
                    value={form.valid_until}
                    onChange={(e) => update('valid_until', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.valid_until ? 'border-red-400' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                  />
                  {formErrors.valid_until && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.valid_until}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setFormErrors({});
                  }}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Cupón
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {couponToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-red-100 p-2 rounded-full">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 font-poppins">
                  Eliminar Cupón
                </h2>
              </div>
              <p className="text-gray-600 mb-2">
                ¿Estás seguro de que deseas eliminar el cupón{' '}
                <span className="font-mono font-semibold">{couponToDelete.code}</span>?
              </p>
              <p className="text-sm text-red-600 mb-6">
                Esta acción no se puede deshacer.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setCouponToDelete(null)}
                  disabled={actionLoadingId === couponToDelete.id}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={actionLoadingId === couponToDelete.id}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl transition-colors font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {actionLoadingId === couponToDelete.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponsCard;
