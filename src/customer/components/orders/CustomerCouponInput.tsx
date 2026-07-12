import React, { useState } from 'react';
import { Tag, X, Check, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react';
import { Coupon } from '../../../types/coupon';

interface CustomerCouponInputProps {
  onApplyCoupon: (code: string) => Promise<void>;
  onRemoveCoupon: () => void;
  appliedCoupon: Coupon | null;
  couponDiscountAmount: number;
  disabled?: boolean;
  validating?: boolean;
  error?: string | null;
}

const CustomerCouponInput: React.FC<CustomerCouponInputProps> = ({
  onApplyCoupon,
  onRemoveCoupon,
  appliedCoupon,
  couponDiscountAmount,
  disabled = false,
  validating = false,
  error = null
}) => {
  const [couponCode, setCouponCode] = useState('');

  const handleApply = async () => {
    if (couponCode.trim()) {
      await onApplyCoupon(couponCode.trim().toUpperCase());
    }
  };

  const handleRemove = () => {
    setCouponCode('');
    onRemoveCoupon();
  };

  return (
    <div>
      {!appliedCoupon ? (
        <div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Ingresa tu código de cupón"
              disabled={disabled || validating}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 uppercase"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleApply();
                }
              }}
            />
            <button
              onClick={handleApply}
              disabled={!couponCode.trim() || disabled || validating}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {validating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4" />
                  <span>Aplicar</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center space-x-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500">
            Los cupones pueden ofrecer descuentos en porcentaje o montos fijos
          </p>
        </div>
      ) : (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-900">
                  Cupón aplicado: {appliedCoupon.code}
                </p>
                <p className="text-sm text-green-700">
                  Descuento: ${couponDiscountAmount.toFixed(2)}
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              disabled={disabled}
              className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerCouponInput;
