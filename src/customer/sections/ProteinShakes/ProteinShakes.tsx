import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, CheckCircle, Zap, Loader2, AlertCircle } from 'lucide-react';
import { proteinPlanService } from '../../../services/proteinPlanService';
import { ProteinPlan } from '../../../types/proteinPlan';
import { useCart } from '../../contexts/CartContext';

export const ProteinShakes: React.FC = () => {
  const navigate = useNavigate();
  const { addProteinToCart } = useCart();

  const [plans, setPlans] = useState<ProteinPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [addedPlanId, setAddedPlanId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await proteinPlanService.getPlans();
        setPlans(data);
        const initial: Record<string, number> = {};
        data.forEach(p => { initial[p.id] = 1; });
        setQuantities(initial);
        if (data.length > 0) setSelectedPlanId(data[0].id);
      } catch {
        setError('No se pudieron cargar los planes de proteína.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const adjustQty = (planId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [planId]: Math.max(1, (prev[planId] ?? 1) + delta)
    }));
  };

  const handleAddToCart = (plan: ProteinPlan) => {
    addProteinToCart({ proteinPlan: plan, quantity: quantities[plan.id] ?? 1 });
    setAddedPlanId(plan.id);
    setTimeout(() => setAddedPlanId(null), 2000);
  };

  if (loading) {
    return (
      <section className="py-20 bg-gray-50 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin text-red-500" />
          <p className="text-sm font-medium">Cargando planes...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-20 bg-gray-50 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-500 max-w-sm text-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </section>
    );
  }

  if (plans.length === 0) {
    return (
      <section className="py-20 bg-gray-50 flex items-center justify-center min-h-[400px]">
        <div className="text-center text-gray-500">
          <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No hay planes disponibles en este momento.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
            <Zap className="w-3.5 h-3.5" />
            Proteína de Alta Calidad
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Planes de Proteína
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Complementa tu dieta con nuestros planes de proteína. Selecciona el que mejor se adapte a tus objetivos.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {plans.map((plan, index) => {
            const qty = quantities[plan.id] ?? 1;
            const isSelected = selectedPlanId === plan.id;
            const isAdded = addedPlanId === plan.id;
            const subtotal = plan.protein_plans_price * qty;
            const isPopular = index === 1 && plans.length >= 3;

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`relative flex flex-col bg-white rounded-2xl border-2 shadow-sm transition-all duration-200 cursor-pointer overflow-hidden
                  ${isSelected
                    ? 'border-red-500 shadow-red-100 shadow-lg scale-[1.02]'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs font-bold text-center py-1.5 tracking-wide uppercase">
                    Más popular
                  </div>
                )}

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}

                <div className={`p-6 flex flex-col flex-1 ${isPopular ? 'pt-10' : ''}`}>
                  {/* Plan ID chip */}
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    {plan.protein_plans_id}
                  </span>

                  {/* Name */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3 leading-snug">
                    {plan.protein_plans_name}
                  </h3>

                  {/* Description */}
                  {plan.protein_plans_description && (
                    <p className="text-sm text-gray-500 leading-relaxed mb-6 flex-1">
                      {plan.protein_plans_description}
                    </p>
                  )}

                  {/* Price */}
                  <div className="mb-5">
                    <span className="text-3xl font-extrabold text-gray-900">
                      ${plan.protein_plans_price.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-400 ml-1">MXN / unidad</span>
                  </div>

                  {/* Quantity selector */}
                  <div
                    className="flex items-center justify-between bg-gray-50 rounded-xl p-1 mb-4"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => adjustQty(plan.id, -1)}
                      disabled={qty <= 1}
                      className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-lg font-bold text-gray-900 w-10 text-center">{qty}</span>
                    <button
                      onClick={() => adjustQty(plan.id, 1)}
                      className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  {qty > 1 && (
                    <p className="text-xs text-gray-500 text-center mb-3">
                      Subtotal: <span className="font-semibold text-gray-700">${subtotal.toFixed(2)} MXN</span>
                    </p>
                  )}

                  {/* Add to cart button */}
                  <button
                    onClick={e => { e.stopPropagation(); handleAddToCart(plan); }}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200
                      ${isAdded
                        ? 'bg-green-500 text-white scale-95'
                        : isSelected
                          ? 'bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg'
                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                      }`}
                  >
                    {isAdded ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        ¡Agregado!
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Agregar al carrito
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA to cart */}
        <div className="text-center">
          <button
            onClick={() => navigate('/cart')}
            className="inline-flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <ShoppingCart className="w-5 h-5" />
            Ver carrito
          </button>
        </div>

      </div>
    </section>
  );
};
