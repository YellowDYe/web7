import React, { useState, useEffect, useCallback } from 'react';
import { Save, CreditCard as Edit, Key, Globe, Eye, EyeOff, Loader as Loader2, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check, Package, ChevronDown, ChevronUp, Settings, RefreshCw, ExternalLink, X, Truck, CreditCard, Play, Users, ShoppingBag, Search } from 'lucide-react';
import {
  woocommerceConfigService,
  WooCommerceConfigForm,
  WooCommerceProductMapping,
  WooCommerceProductMappingForm,
  WooCommerceShippingMapping,
  WooCommerceShippingMappingForm,
  WooCommercePaymentMapping,
  WooCommercePaymentMappingForm,
  WooCommerceTestCustomer,
  WooCommerceTestOrder,
  WooCommerceTestOrderWeek,
} from '../../services/woocommerceConfigService';
import { mealPlanService } from '../../services/mealPlanService';
import { deliveryOptionService } from '../../services/deliveryOptionService';
import { bankAccountService } from '../../services/bankAccountService';
import { MealPlan } from '../../types/mealPlan';
import { DeliveryOption } from '../../types/deliveryOption';
import { BankAccount } from '../../types/bankAccount';
import { DAYS_OF_WEEK, MEAL_TYPES } from '../../types/mealTypes';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = [...DAYS_OF_WEEK] as string[];
const MEAL_LABELS = MEAL_TYPES.map(m => m.label) as string[];

const CUTOFF_DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

function MultiSelectChips({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              active
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Mapping Form Modal ────────────────────────────────────────────────────────

interface MappingFormModalProps {
  mealPlans: MealPlan[];
  initial?: WooCommerceProductMapping | null;
  onSave: (form: WooCommerceProductMappingForm) => Promise<void>;
  onClose: () => void;
}

const EMPTY_MAPPING: WooCommerceProductMappingForm = {
  wc_product_id: '',
  product_name: '',
  meal_plan_id: '',
  days_of_week: [...DAYS],
  meal_types: ['Comida'],
  num_weeks: 1,
  is_active: true,
};

const MappingFormModal: React.FC<MappingFormModalProps> = ({ mealPlans, initial, onSave, onClose }) => {
  const [form, setForm] = useState<WooCommerceProductMappingForm>(
    initial
      ? {
          wc_product_id: initial.wc_product_id,
          product_name: initial.product_name,
          meal_plan_id: initial.meal_plan_id,
          days_of_week: initial.days_of_week,
          meal_types: initial.meal_types,
          num_weeks: initial.num_weeks ?? 1,
          is_active: initial.is_active,
        }
      : EMPTY_MAPPING
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.wc_product_id.trim()) { setError('El ID del producto es requerido'); return; }
    if (!form.product_name.trim()) { setError('El nombre es requerido'); return; }
    if (!form.meal_plan_id) { setError('Selecciona un plan de comidas'); return; }
    if (form.days_of_week.length === 0) { setError('Selecciona al menos un día'); return; }
    if (form.meal_types.length === 0) { setError('Selecciona al menos un tipo de comida'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {initial ? 'Editar mapeo' : 'Nuevo mapeo de producto'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ID de producto WooCommerce *</label>
              <input
                type="text"
                value={form.wc_product_id}
                onChange={e => setForm(p => ({ ...p, wc_product_id: e.target.value }))}
                placeholder="987466843"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del producto *</label>
              <input
                type="text"
                value={form.product_name}
                onChange={e => setForm(p => ({ ...p, product_name: e.target.value }))}
                placeholder="Plan Balance L-V Comidas"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Plan de comidas *</label>
            <select
              value={form.meal_plan_id}
              onChange={e => setForm(p => ({ ...p, meal_plan_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">Seleccionar plan...</option>
              {mealPlans.map(mp => (
                <option key={mp.meal_plans_id} value={mp.meal_plans_id}>
                  {mp.meal_plans_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Días de la semana *</label>
            <MultiSelectChips options={DAYS} selected={form.days_of_week} onChange={v => setForm(p => ({ ...p, days_of_week: v }))} />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setForm(p => ({ ...p, days_of_week: [...DAYS] }))} className="text-xs text-gray-500 hover:text-gray-700">Todos</button>
              <span className="text-xs text-gray-400">·</span>
              <button type="button" onClick={() => setForm(p => ({ ...p, days_of_week: [] }))} className="text-xs text-gray-500 hover:text-gray-700">Ninguno</button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Tipos de comida *</label>
            <MultiSelectChips options={MEAL_LABELS} selected={form.meal_types} onChange={v => setForm(p => ({ ...p, meal_types: v }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Semanas consecutivas *</label>
            <select
              value={form.num_weeks}
              onChange={e => setForm(p => ({ ...p, num_weeks: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value={1}>1 semana</option>
              <option value={2}>2 semanas</option>
              <option value={3}>3 semanas</option>
              <option value={4}>4 semanas</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Cuántas semanas consecutivas abarca este producto</p>
          </div>

          <div className="flex items-center gap-3 py-1">
            <label className="text-sm font-medium text-gray-700">Activo</label>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-gray-900' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {initial ? 'Guardar cambios' : 'Crear mapeo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Shipping Form Modal ───────────────────────────────────────────────────────

interface ShippingFormModalProps {
  deliveryOptions: DeliveryOption[];
  initial?: WooCommerceShippingMapping | null;
  onSave: (form: WooCommerceShippingMappingForm) => Promise<void>;
  onClose: () => void;
}

const EMPTY_SHIPPING: WooCommerceShippingMappingForm = {
  shipping_total: 0,
  method_title: '',
  delivery_option_id: '',
  is_active: true,
};

const ShippingFormModal: React.FC<ShippingFormModalProps> = ({ deliveryOptions, initial, onSave, onClose }) => {
  const [form, setForm] = useState<WooCommerceShippingMappingForm>(
    initial
      ? {
          shipping_total: initial.shipping_total,
          method_title: initial.method_title,
          delivery_option_id: initial.delivery_option_id,
          is_active: initial.is_active,
        }
      : EMPTY_SHIPPING
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.shipping_total < 0) { setError('El monto de envío no puede ser negativo'); return; }
    if (!form.delivery_option_id) { setError('Selecciona una opción de entrega'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {initial ? 'Editar mapeo de envío' : 'Nuevo mapeo de envío'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Monto de envío WooCommerce *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.shipping_total}
              onChange={e => setForm(p => ({ ...p, shipping_total: parseFloat(e.target.value) || 0 }))}
              placeholder="100.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Valor del campo <code className="font-mono">shipping_total</code> en el payload de WooCommerce (ej. 100.00 = Semanal)</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre descriptivo</label>
            <input
              type="text"
              value={form.method_title}
              onChange={e => setForm(p => ({ ...p, method_title: e.target.value }))}
              placeholder="Envío a domicilio"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Opción de entrega *</label>
            <select
              value={form.delivery_option_id}
              onChange={e => setForm(p => ({ ...p, delivery_option_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">Seleccionar opción...</option>
              {deliveryOptions.map(opt => (
                <option key={opt.delivery_options_id} value={opt.delivery_options_id}>
                  {opt.delivery_options_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 py-1">
            <label className="text-sm font-medium text-gray-700">Activo</label>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-gray-900' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {initial ? 'Guardar cambios' : 'Crear mapeo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Payment Form Modal ────────────────────────────────────────────────────────

interface PaymentFormModalProps {
  bankAccounts: BankAccount[];
  initial?: WooCommercePaymentMapping | null;
  onSave: (form: WooCommercePaymentMappingForm) => Promise<void>;
  onClose: () => void;
}

const EMPTY_PAYMENT: WooCommercePaymentMappingForm = {
  wc_method_id: '',
  method_title: '',
  internal_label: '',
  bank_account_id: null,
  is_active: true,
};

const PaymentFormModal: React.FC<PaymentFormModalProps> = ({ bankAccounts, initial, onSave, onClose }) => {
  const [form, setForm] = useState<WooCommercePaymentMappingForm>(
    initial
      ? {
          wc_method_id: initial.wc_method_id,
          method_title: initial.method_title,
          internal_label: initial.internal_label,
          bank_account_id: initial.bank_account_id ?? null,
          is_active: initial.is_active,
        }
      : EMPTY_PAYMENT
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.wc_method_id.trim()) { setError('El ID del método de pago es requerido'); return; }
    if (!form.internal_label.trim()) { setError('La etiqueta interna es requerida'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {initial ? 'Editar método de pago' : 'Nuevo método de pago'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ID del método de pago WooCommerce *</label>
            <input
              type="text"
              value={form.wc_method_id}
              onChange={e => setForm(p => ({ ...p, wc_method_id: e.target.value }))}
              placeholder="woo-mercado-pago-custom"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Valor del campo <code className="font-mono">payment_method</code> en el payload de WooCommerce</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre en WooCommerce</label>
            <input
              type="text"
              value={form.method_title}
              onChange={e => setForm(p => ({ ...p, method_title: e.target.value }))}
              placeholder="Débito o crédito"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Valor del campo <code className="font-mono">payment_method_title</code> en el payload</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Etiqueta interna *</label>
            <input
              type="text"
              value={form.internal_label}
              onChange={e => setForm(p => ({ ...p, internal_label: e.target.value }))}
              placeholder="Mercado Pago"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Nombre que se mostrará en el sistema</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cuenta bancaria asociada</label>
            <select
              value={form.bank_account_id ?? ''}
              onChange={e => setForm(p => ({ ...p, bank_account_id: e.target.value || null }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">— Sin asignar (facturas en borrador) —</option>
              {bankAccounts.map(ba => (
                <option key={ba.account_id} value={ba.account_id}>{ba.account_name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Los pagos de este método se acreditarán en esta cuenta. Sin cuenta, la factura se crea como borrador.</p>
          </div>

          <div className="flex items-center gap-3 py-1">
            <label className="text-sm font-medium text-gray-700">Activo</label>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-gray-900' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {initial ? 'Guardar cambios' : 'Crear mapeo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'config' | 'mappings' | 'shipping' | 'payments' | 'test_customers' | 'test_orders';

const WooCommerceSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('config');

  // Config state
  const [configForm, setConfigForm] = useState<WooCommerceConfigForm>({
    store_url: '', consumer_key: '', consumer_secret: '', webhook_secret: '',
    cutoff_day: 5, cutoff_hour: 12, test_mode: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showConsumerKey, setShowConsumerKey] = useState(false);
  const [showConsumerSecret, setShowConsumerSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Mappings state
  const [mappings, setMappings] = useState<WooCommerceProductMapping[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [mappingsError, setMappingsError] = useState<string | null>(null);
  const [showMappingForm, setShowMappingForm] = useState(false);
  const [editingMapping, setEditingMapping] = useState<WooCommerceProductMapping | null>(null);
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);

  // Shipping mappings state
  const [shippingMappings, setShippingMappings] = useState<WooCommerceShippingMapping[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [editingShipping, setEditingShipping] = useState<WooCommerceShippingMapping | null>(null);
  const [deletingShippingId, setDeletingShippingId] = useState<string | null>(null);

  // Payment mappings state
  const [paymentMappings, setPaymentMappings] = useState<WooCommercePaymentMapping[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<WooCommercePaymentMapping | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);


  // Test customers state
  const [testCustomers, setTestCustomers] = useState<WooCommerceTestCustomer[]>([]);
  const [testCustomersLoading, setTestCustomersLoading] = useState(false);
  const [testCustomersError, setTestCustomersError] = useState<string | null>(null);
  const [deletingTestCustomerId, setDeletingTestCustomerId] = useState<string | null>(null);
  const [deletingAllTestCustomers, setDeletingAllTestCustomers] = useState(false);

  // Test orders state
  const [testOrders, setTestOrders] = useState<WooCommerceTestOrder[]>([]);
  const [testOrdersLoading, setTestOrdersLoading] = useState(false);
  const [testOrdersError, setTestOrdersError] = useState<string | null>(null);
  const [deletingTestOrderId, setDeletingTestOrderId] = useState<string | null>(null);
  const [deletingAllTestOrders, setDeletingAllTestOrders] = useState(false);

  // Expanded rows state
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [orderWeeksCache, setOrderWeeksCache] = useState<Record<string, WooCommerceTestOrderWeek[]>>({});
  const [orderWeeksLoading, setOrderWeeksLoading] = useState<Record<string, boolean>>({});

  const toggleCustomerExpand = (customerId: string) => {
    setExpandedCustomerIds(prev => {
      const next = new Set(prev);
      next.has(customerId) ? next.delete(customerId) : next.add(customerId);
      return next;
    });
  };

  const toggleOrderExpand = async (orderId: string) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
    if (!orderWeeksCache[orderId]) {
      setOrderWeeksLoading(prev => ({ ...prev, [orderId]: true }));
      try {
        const weeks = await woocommerceConfigService.getTestOrderWeeks(orderId);
        setOrderWeeksCache(prev => ({ ...prev, [orderId]: weeks }));
      } catch {
        setOrderWeeksCache(prev => ({ ...prev, [orderId]: [] }));
      } finally {
        setOrderWeeksLoading(prev => ({ ...prev, [orderId]: false }));
      }
    }
  };

  const summarizeQtys = (week: WooCommerceTestOrderWeek): string => {
    const dayKeys: [string, string][] = [
      ['lunes', 'Lun'], ['martes', 'Mar'], ['miercoles', 'Mie'],
      ['jueves', 'Jue'], ['viernes', 'Vie'],
    ];
    const mealKeys: [string, string][] = [
      ['desayuno', 'Des'], ['colacion_am', 'C.AM'], ['comida', 'Com'],
      ['colacion_pm', 'C.PM'], ['cena', 'Cen'],
    ];
    const parts: string[] = [];
    for (const [dayKey, dayLabel] of dayKeys) {
      const meals: string[] = [];
      for (const [mealKey, mealLabel] of mealKeys) {
        const val = (week as unknown as Record<string, number>)[`${dayKey}_${mealKey}_qty`];
        if (val > 0) meals.push(mealLabel);
      }
      if (meals.length) parts.push(`${dayLabel}: ${meals.join(', ')}`);
    }
    return parts.length ? parts.join(' | ') : 'Sin tiempos';
  };

  const webhookUrl = woocommerceConfigService.getWebhookUrl();

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'mappings' && mappings.length === 0 && !mappingsLoading) {
      loadMappings();
    }
    if (activeTab === 'shipping' && shippingMappings.length === 0 && !shippingLoading) {
      loadShippingMappings();
    }
    if (activeTab === 'payments' && paymentMappings.length === 0 && !paymentLoading) {
      loadPaymentMappings();
    }
if (activeTab === 'test_customers') {
      loadTestCustomers();
    }
    if (activeTab === 'test_orders') {
      loadTestOrders();
    }
  }, [activeTab]);

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const form = await woocommerceConfigService.getConfigForm();
      setConfigForm(form);
    } catch (err) {
      setConfigError('Error al cargar la configuración');
    } finally {
      setConfigLoading(false);
    }
  };

  const loadMappings = async () => {
    try {
      setMappingsLoading(true);
      setMappingsError(null);
      const [m, mp, dos] = await Promise.all([
        woocommerceConfigService.getMappings(),
        mealPlanService.getPlans(),
        deliveryOptionService.getOptions(),
      ]);
      setMappings(m);
      setMealPlans(mp);
      setDeliveryOptions(dos);
    } catch (err) {
      setMappingsError('Error al cargar los mapeos');
    } finally {
      setMappingsLoading(false);
    }
  };


  const loadTestCustomers = async () => {
    setTestCustomersLoading(true);
    setTestCustomersError(null);
    try {
      setTestCustomers(await woocommerceConfigService.getTestCustomers());
    } catch (err) {
      setTestCustomersError(err instanceof Error ? err.message : 'Error al cargar clientes de prueba');
    } finally {
      setTestCustomersLoading(false);
    }
  };

  const handleDeleteTestCustomer = async (customerId: string) => {
    setDeletingTestCustomerId(customerId);
    try {
      await woocommerceConfigService.deleteTestCustomer(customerId);
      setTestCustomers(prev => prev.filter(c => c.customer_id !== customerId));
    } finally {
      setDeletingTestCustomerId(null);
    }
  };

  const handleDeleteAllTestCustomers = async () => {
    setDeletingAllTestCustomers(true);
    try {
      await woocommerceConfigService.deleteAllTestCustomers();
      setTestCustomers([]);
    } finally {
      setDeletingAllTestCustomers(false);
    }
  };

  const loadTestOrders = async () => {
    setTestOrdersLoading(true);
    setTestOrdersError(null);
    try {
      setTestOrders(await woocommerceConfigService.getTestOrders());
    } catch (err) {
      setTestOrdersError(err instanceof Error ? err.message : 'Error al cargar pedidos de prueba');
    } finally {
      setTestOrdersLoading(false);
    }
  };

  const handleDeleteTestOrder = async (orderId: string) => {
    setDeletingTestOrderId(orderId);
    try {
      await woocommerceConfigService.deleteTestOrder(orderId);
      setTestOrders(prev => prev.filter(o => o.order_id !== orderId));
    } finally {
      setDeletingTestOrderId(null);
    }
  };

  const handleDeleteAllTestOrders = async () => {
    setDeletingAllTestOrders(true);
    try {
      await woocommerceConfigService.deleteAllTestOrders();
      setTestOrders([]);
    } finally {
      setDeletingAllTestOrders(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaveLoading(true);
      setConfigError(null);
      if (!configForm.store_url.trim()) { setConfigError('La URL de la tienda es requerida'); return; }
      if (!configForm.consumer_key.trim()) { setConfigError('El Consumer Key es requerido'); return; }
      if (!configForm.consumer_secret.trim()) { setConfigError('El Consumer Secret es requerido'); return; }
      if (!configForm.webhook_secret.trim()) { setConfigError('El Webhook Secret es requerido'); return; }
      await woocommerceConfigService.saveConfig(configForm);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCopyWebhook = useCallback(async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  }, [webhookUrl]);

  const handleSaveMapping = async (form: WooCommerceProductMappingForm) => {
    if (editingMapping) {
      await woocommerceConfigService.updateMapping(editingMapping.id, form);
    } else {
      await woocommerceConfigService.createMapping(form);
    }
    setShowMappingForm(false);
    setEditingMapping(null);
    await loadMappings();
  };

  const handleDeleteMapping = async (id: string) => {
    setDeletingMappingId(id);
    try {
      await woocommerceConfigService.deleteMapping(id);
      setMappings(prev => prev.filter(m => m.id !== id));
    } finally {
      setDeletingMappingId(null);
    }
  };

  const handleToggleMappingActive = async (mapping: WooCommerceProductMapping) => {
    await woocommerceConfigService.updateMapping(mapping.id, { is_active: !mapping.is_active });
    setMappings(prev => prev.map(m => m.id === mapping.id ? { ...m, is_active: !m.is_active } : m));
  };

  const loadShippingMappings = async () => {
    try {
      setShippingLoading(true);
      setShippingError(null);
      const [sm, dos] = await Promise.all([
        woocommerceConfigService.getShippingMappings(),
        deliveryOptionService.getOptions(),
      ]);
      setShippingMappings(sm);
      setDeliveryOptions(dos);
    } catch {
      setShippingError('Error al cargar los mapeos de envío');
    } finally {
      setShippingLoading(false);
    }
  };

  const handleSaveShipping = async (form: WooCommerceShippingMappingForm) => {
    if (editingShipping) {
      await woocommerceConfigService.updateShippingMapping(editingShipping.id, form);
    } else {
      await woocommerceConfigService.createShippingMapping(form);
    }
    setShowShippingForm(false);
    setEditingShipping(null);
    await loadShippingMappings();
  };

  const handleDeleteShipping = async (id: string) => {
    setDeletingShippingId(id);
    try {
      await woocommerceConfigService.deleteShippingMapping(id);
      setShippingMappings(prev => prev.filter(m => m.id !== id));
    } finally {
      setDeletingShippingId(null);
    }
  };

  const handleToggleShippingActive = async (mapping: WooCommerceShippingMapping) => {
    await woocommerceConfigService.updateShippingMapping(mapping.id, { is_active: !mapping.is_active });
    setShippingMappings(prev => prev.map(m => m.id === mapping.id ? { ...m, is_active: !m.is_active } : m));
  };

  const loadPaymentMappings = async () => {
    try {
      setPaymentLoading(true);
      setPaymentError(null);
      const [pm, bas] = await Promise.all([
        woocommerceConfigService.getPaymentMappings(),
        bankAccountService.getAccounts(),
      ]);
      setPaymentMappings(pm);
      setBankAccounts(bas);
    } catch {
      setPaymentError('Error al cargar los métodos de pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSavePayment = async (form: WooCommercePaymentMappingForm) => {
    if (editingPayment) {
      await woocommerceConfigService.updatePaymentMapping(editingPayment.id, form);
    } else {
      await woocommerceConfigService.createPaymentMapping(form);
    }
    setShowPaymentForm(false);
    setEditingPayment(null);
    await loadPaymentMappings();
  };

  const handleDeletePayment = async (id: string) => {
    setDeletingPaymentId(id);
    try {
      await woocommerceConfigService.deletePaymentMapping(id);
      setPaymentMappings(prev => prev.filter(m => m.id !== id));
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleTogglePaymentActive = async (mapping: WooCommercePaymentMapping) => {
    await woocommerceConfigService.updatePaymentMapping(mapping.id, { is_active: !mapping.is_active });
    setPaymentMappings(prev => prev.map(m => m.id === mapping.id ? { ...m, is_active: !m.is_active } : m));
  };

  const mealPlanName = (id: string) => mealPlans.find(mp => mp.meal_plans_id === id)?.meal_plans_name ?? id;
  const deliveryOptionName = (id: string) => deliveryOptions.find(o => o.delivery_options_id === id)?.delivery_options_name ?? id;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'config', label: 'Conexión', icon: <Settings className="w-4 h-4" /> },
    { key: 'mappings', label: 'Productos', icon: <Package className="w-4 h-4" /> },
    { key: 'shipping', label: 'Envíos', icon: <Truck className="w-4 h-4" /> },
    { key: 'payments', label: 'Pagos', icon: <CreditCard className="w-4 h-4" /> },
{ key: 'test_customers', label: 'Clientes prueba', icon: <Users className="w-4 h-4" /> },
    { key: 'test_orders', label: 'Pedidos prueba', icon: <ShoppingBag className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONFIG TAB ── */}
      {activeTab === 'config' && (
        <div className="space-y-5">
          {configLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {saveSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  Configuración guardada correctamente
                </div>
              )}
              {configError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {configError}
                </div>
              )}

              {/* Webhook URL */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">URL del Webhook</span>
                </div>
                <p className="text-xs text-gray-500">Pega esta URL en WooCommerce → Ajustes → Avanzado → Webhooks. Evento: <strong>Pedido creado</strong>.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 break-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={handleCopyWebhook}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedWebhook ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Credentials */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Credenciales API</h4>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Editar
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">URL de la tienda WooCommerce *</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      value={configForm.store_url}
                      onChange={e => { setConfigForm(p => ({ ...p, store_url: e.target.value })); if (saveSuccess) setSaveSuccess(false); }}
                      placeholder="https://mitienda.com"
                      disabled={!isEditing}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>

                {[
                  { label: 'Consumer Key', field: 'consumer_key' as const, show: showConsumerKey, setShow: setShowConsumerKey, placeholder: 'ck_...' },
                  { label: 'Consumer Secret', field: 'consumer_secret' as const, show: showConsumerSecret, setShow: setShowConsumerSecret, placeholder: 'cs_...' },
                  { label: 'Webhook Secret', field: 'webhook_secret' as const, show: showWebhookSecret, setShow: setShowWebhookSecret, placeholder: 'Clave secreta para verificar firmas' },
                ].map(({ label, field, show, setShow, placeholder }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label} *</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={show ? 'text' : 'password'}
                        value={configForm[field]}
                        onChange={e => { setConfigForm(p => ({ ...p, [field]: e.target.value })); if (saveSuccess) setSaveSuccess(false); }}
                        placeholder={isEditing ? placeholder : '••••••••••••'}
                        disabled={!isEditing}
                        className="w-full pl-9 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setShow(!show)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Cutoff */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Día de corte</label>
                    <select
                      value={configForm.cutoff_day}
                      onChange={e => setConfigForm(p => ({ ...p, cutoff_day: parseInt(e.target.value) }))}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      {CUTOFF_DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hora de corte (hora México)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={configForm.cutoff_hour}
                      onChange={e => setConfigForm(p => ({ ...p, cutoff_hour: parseInt(e.target.value) || 0 }))}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Pedidos recibidos después del día/hora de corte se asignan a la semana siguiente.</p>
              </div>

              {/* Test Mode */}
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-blue-900">Modo de prueba</p>
                  <p className="text-xs text-blue-600 mt-0.5">Los pedidos entrantes se registran en el log sin crear clientes ni órdenes.</p>
                </div>
                <button
                  type="button"
                  disabled={!isEditing}
                  onClick={() => setConfigForm(p => ({ ...p, test_mode: !p.test_mode }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${configForm.test_mode ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${configForm.test_mode ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>

              {isEditing && (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setIsEditing(false); setConfigError(null); loadConfig(); }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={saveLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar configuración
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── MAPPINGS TAB ── */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Cada mapeo conecta un producto de WooCommerce con un plan de comidas, días y tipos de comida.
              </p>
            </div>
            <button
              onClick={() => { setEditingMapping(null); setShowMappingForm(true); }}
              className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nuevo mapeo
            </button>
          </div>

          {mappingsError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {mappingsError}
            </div>
          )}

          {mappingsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No hay mapeos configurados</p>
              <p className="text-xs text-gray-400 mt-1">Crea un mapeo para conectar productos de WooCommerce con planes de comidas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mappings.map(mapping => (
                <div
                  key={mapping.id}
                  className={`border rounded-xl p-4 transition-colors ${mapping.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">{mapping.product_name}</span>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">#{mapping.wc_product_id}</code>
                        {!mapping.is_active && (
                          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-lg">{mealPlanName(mapping.meal_plan_id)}</span>
                        {mapping.days_of_week.map(d => (
                          <span key={d} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{d}</span>
                        ))}
                        {mapping.meal_types.map(t => (
                          <span key={t} className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-lg">{t}</span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {mapping.num_weeks ?? 1} {(mapping.num_weeks ?? 1) === 1 ? 'semana' : 'semanas'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggleMappingActive(mapping)}
                        className={`p-1.5 rounded-lg transition-colors ${mapping.is_active ? 'text-gray-900 hover:bg-gray-100' : 'text-gray-400 hover:bg-gray-100'}`}
                        title={mapping.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {mapping.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setEditingMapping(mapping); setShowMappingForm(true); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        disabled={deletingMappingId === mapping.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingMappingId === mapping.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SHIPPING TAB ── */}
      {activeTab === 'shipping' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Conecta los métodos de envío de WooCommerce con las opciones de entrega del sistema.
            </p>
            <button
              onClick={() => { setEditingShipping(null); setShowShippingForm(true); }}
              className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nuevo mapeo
            </button>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
            El método de envío del pedido WooCommerce se lee del primer elemento de <code className="font-mono bg-blue-100 px-1 rounded">shipping_lines</code>. El campo <strong>ID del método</strong> corresponde a <code className="font-mono bg-blue-100 px-1 rounded">method_id</code> en el payload (ej. <code className="font-mono bg-blue-100 px-1 rounded">flat_rate:3</code>, <code className="font-mono bg-blue-100 px-1 rounded">free_shipping</code>).
          </div>

          {shippingError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {shippingError}
            </div>
          )}

          {shippingLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : shippingMappings.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Truck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No hay mapeos de envío configurados</p>
              <p className="text-xs text-gray-400 mt-1">Crea un mapeo para que los pedidos WooCommerce reciban su opción de entrega automáticamente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shippingMappings.map(mapping => (
                <div
                  key={mapping.id}
                  className={`border rounded-xl p-4 transition-colors ${mapping.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono">${Number(mapping.shipping_total).toFixed(2)}</code>
                        {mapping.method_title && (
                          <span className="text-sm text-gray-600">{mapping.method_title}</span>
                        )}
                        {!mapping.is_active && (
                          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-lg">
                          {deliveryOptionName(mapping.delivery_option_id)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggleShippingActive(mapping)}
                        className={`p-1.5 rounded-lg transition-colors ${mapping.is_active ? 'text-gray-900 hover:bg-gray-100' : 'text-gray-400 hover:bg-gray-100'}`}
                        title={mapping.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {mapping.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setEditingShipping(mapping); setShowShippingForm(true); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteShipping(mapping.id)}
                        disabled={deletingShippingId === mapping.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingShippingId === mapping.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Mapea los métodos de pago de WooCommerce a etiquetas internas.</p>
              <p className="text-xs text-gray-400 mt-0.5">El ID del método de pago proviene del campo <code className="font-mono">payment_method</code> del payload.</p>
            </div>
            <button
              onClick={() => { setEditingPayment(null); setShowPaymentForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs font-medium flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar método
            </button>
          </div>

          {paymentError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {paymentError}
            </div>
          )}

          {paymentLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : paymentMappings.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Sin métodos de pago configurados</p>
              <p className="text-xs text-gray-400 mt-1">Agrega un mapeo para identificar los pagos recibidos desde WooCommerce</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">ID en WooCommerce</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre WC</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Etiqueta interna</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cuenta bancaria</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Activo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paymentMappings.map(pm => (
                    <tr key={pm.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{pm.wc_method_id}</code>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{pm.method_title || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{pm.internal_label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {pm.bank_account_id
                          ? (bankAccounts.find(ba => ba.account_id === pm.bank_account_id)?.account_name ?? pm.bank_account_id)
                          : <span className="text-amber-600 italic">Sin asignar</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleTogglePaymentActive(pm)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pm.is_active ? 'bg-gray-900' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pm.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingPayment(pm); setShowPaymentForm(true); }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(pm.id)}
                            disabled={deletingPaymentId === pm.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Eliminar"
                          >
                            {deletingPaymentId === pm.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Reference card */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-2">Métodos de pago comunes en México</p>
            <div className="space-y-1.5">
              {[
                { id: 'woo-mercado-pago-custom', label: 'Mercado Pago (crédito/débito)' },
                { id: 'woo-mercado-pago-basic', label: 'Mercado Pago (básico / checkout pro)' },
                { id: 'paypal', label: 'PayPal' },
                { id: 'bacs', label: 'Transferencia bancaria (BACS)' },
                { id: 'cod', label: 'Pago contra entrega' },
              ].map(item => (
                <div key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
                  <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-700 font-mono">{item.id}</code>
                  <span className="text-gray-400">→</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TEST CUSTOMERS TAB ── */}
      {activeTab === 'test_customers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">Clientes creados durante el procesamiento de pedidos de prueba.</p>
              <p className="text-xs text-gray-400 mt-0.5">Estos registros están marcados como prueba y pueden eliminarse de forma segura.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={loadTestCustomers}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar
              </button>
              {testCustomers.length > 0 && (
                <button
                  onClick={handleDeleteAllTestCustomers}
                  disabled={deletingAllTestCustomers}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium disabled:opacity-50"
                >
                  {deletingAllTestCustomers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Eliminar todos
                </button>
              )}
            </div>
          </div>

          {testCustomersError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {testCustomersError}
            </div>
          )}

          {testCustomersLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : testCustomers.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Sin clientes de prueba</p>
              <p className="text-xs text-gray-400 mt-1">Procesa un pedido en modo prueba para ver los clientes aquí</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Teléfono</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Creado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {testCustomers.map(c => {
                    const isExpanded = expandedCustomerIds.has(c.customer_id);
                    return (
                      <React.Fragment key={c.id}>
                        <tr className="bg-white hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{c.customer_id}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{`${c.customer_name} ${c.customer_lastname}`.trim()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{c.customer_phone || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {new Date(c.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => toggleCustomerExpand(c.customer_id)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {isExpanded ? 'Ocultar' : 'Ver'}
                              </button>
                              <button
                                onClick={() => handleDeleteTestCustomer(c.customer_id)}
                                disabled={deletingTestCustomerId === c.customer_id}
                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                              >
                                {deletingTestCustomerId === c.customer_id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-blue-50/40">
                            <td colSpan={5} className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                {/* Contact & Identity */}
                                <div className="space-y-2">
                                  <p className="font-semibold text-gray-700 uppercase tracking-wide text-[10px]">Contacto</p>
                                  <div className="space-y-1">
                                    <p className="text-gray-600"><span className="text-gray-400">Email real:</span> {c.customer_email}</p>
                                    <p className="text-gray-600"><span className="text-gray-400">Teléfono:</span> {c.customer_phone || '—'}</p>
                                  </div>
                                </div>
                                {/* Delivery Address */}
                                <div className="space-y-2">
                                  <p className="font-semibold text-gray-700 uppercase tracking-wide text-[10px]">Dirección de entrega</p>
                                  <div className="space-y-1 text-gray-600">
                                    <p>{c.customer_street} {c.customer_street_number} {c.customer_interior_number && `Int. ${c.customer_interior_number}`}</p>
                                    <p>{c.customer_colonia || '—'}</p>
                                    <p>{c.customer_delegacion} {c.customer_postal_code && `CP ${c.customer_postal_code}`}</p>
                                    {c.customer_delivery_instructions && (
                                      <p className="italic text-gray-500">Instrucciones: {c.customer_delivery_instructions}</p>
                                    )}
                                  </div>
                                </div>
                                {/* Billing */}
                                <div className="space-y-2">
                                  <p className="font-semibold text-gray-700 uppercase tracking-wide text-[10px]">Facturación</p>
                                  <div className="space-y-1 text-gray-600">
                                    <p>{c.billing_name || '—'}</p>
                                    <p>{c.billing_street}</p>
                                    <p>{c.billing_neighborhood} {c.billing_postal_code && `CP ${c.billing_postal_code}`}</p>
                                    <p>{c.billing_municipality}{c.billing_state && `, ${c.billing_state}`}</p>
                                  </div>
                                </div>
                                {/* Notes full width */}
                                {c.customer_notes && (
                                  <div className="md:col-span-3 space-y-1 pt-1 border-t border-blue-100">
                                    <p className="font-semibold text-gray-700 uppercase tracking-wide text-[10px]">Notas</p>
                                    <p className="text-gray-600 break-words">{c.customer_notes}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TEST ORDERS TAB ── */}
      {activeTab === 'test_orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">Pedidos creados durante el procesamiento de pedidos de prueba.</p>
              <p className="text-xs text-gray-400 mt-0.5">Eliminar un pedido también elimina sus semanas asociadas.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={loadTestOrders}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar
              </button>
              {testOrders.length > 0 && (
                <button
                  onClick={handleDeleteAllTestOrders}
                  disabled={deletingAllTestOrders}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium disabled:opacity-50"
                >
                  {deletingAllTestOrders ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Eliminar todos
                </button>
              )}
            </div>
          </div>

          {testOrdersError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {testOrdersError}
            </div>
          )}

          {testOrdersLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : testOrders.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Sin pedidos de prueba</p>
              <p className="text-xs text-gray-400 mt-1">Procesa un pedido en modo prueba para ver los pedidos aquí</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">ID Pedido</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Creado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {testOrders.map(o => {
                    const isExpanded = expandedOrderIds.has(o.order_id);
                    const weeks = orderWeeksCache[o.order_id];
                    const weeksLoading = orderWeeksLoading[o.order_id];
                    return (
                      <React.Fragment key={o.id}>
                        <tr className="bg-white hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{o.order_id}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{o.order_customer_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                            ${Number(o.order_total_price).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium capitalize">{o.order_status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {new Date(o.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => toggleOrderExpand(o.order_id)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {isExpanded ? 'Ocultar' : 'Ver'}
                              </button>
                              <button
                                onClick={() => handleDeleteTestOrder(o.order_id)}
                                disabled={deletingTestOrderId === o.order_id}
                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                              >
                                {deletingTestOrderId === o.order_id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-blue-50/40">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="space-y-4 text-xs">
                                {/* Order metadata */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <p className="font-semibold text-gray-700 uppercase tracking-wide text-[10px] mb-1">Datos del pedido</p>
                                    <p className="text-gray-600"><span className="text-gray-400">Email:</span> {o.order_customer_email}</p>
                                    <p className="text-gray-600"><span className="text-gray-400">Opción de envío ID:</span> {o.delivery_option_id || '—'}</p>
                                  </div>
                                  {o.order_notes && (
                                    <div>
                                      <p className="font-semibold text-gray-700 uppercase tracking-wide text-[10px] mb-1">Notas</p>
                                      <p className="text-gray-600 break-words">{o.order_notes}</p>
                                    </div>
                                  )}
                                </div>
                                {/* Order weeks */}
                                <div>
                                  <p className="font-semibold text-gray-700 uppercase tracking-wide text-[10px] mb-2">Semanas del pedido</p>
                                  {weeksLoading ? (
                                    <div className="flex items-center gap-2 text-gray-400">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Cargando semanas...
                                    </div>
                                  ) : !weeks || weeks.length === 0 ? (
                                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                      <span>No se crearon semanas para este pedido — revisa los mapeos de productos</span>
                                    </div>
                                  ) : (
                                    <div className="rounded-lg border border-blue-100 overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-blue-100/50 border-b border-blue-100">
                                            <th className="text-left px-3 py-2 font-semibold text-gray-600">Semana</th>
                                            <th className="text-left px-3 py-2 font-semibold text-gray-600">Fecha entrega</th>
                                            <th className="text-left px-3 py-2 font-semibold text-gray-600">Plan</th>
                                            <th className="text-left px-3 py-2 font-semibold text-gray-600">Días y tiempos</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-blue-50">
                                          {weeks.map(w => (
                                            <tr key={w.order_week_id} className="bg-white">
                                              <td className="px-3 py-2 text-gray-700">{w.week_name || w.week_id}</td>
                                              <td className="px-3 py-2 text-gray-600">{w.delivery_date || '—'}</td>
                                              <td className="px-3 py-2 text-gray-600">{w.meal_plan_name || w.meal_plan_id || '—'}</td>
                                              <td className="px-3 py-2 text-gray-600 font-mono">{summarizeQtys(w)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Mapping form modal */}
      {showMappingForm && (
        <MappingFormModal
          mealPlans={mealPlans}
          initial={editingMapping}
          onSave={handleSaveMapping}
          onClose={() => { setShowMappingForm(false); setEditingMapping(null); }}
        />
      )}

      {showShippingForm && (
        <ShippingFormModal
          deliveryOptions={deliveryOptions}
          initial={editingShipping}
          onSave={handleSaveShipping}
          onClose={() => { setShowShippingForm(false); setEditingShipping(null); }}
        />
      )}

      {showPaymentForm && (
        <PaymentFormModal
          bankAccounts={bankAccounts}
          initial={editingPayment}
          onSave={handleSavePayment}
          onClose={() => { setShowPaymentForm(false); setEditingPayment(null); }}
        />
      )}

    </div>
  );
};

export default WooCommerceSettings;
