import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PendingOrderItem } from '../../types/orderMenu';
import { SelectedWeek } from '../../types/week';
import { DeliveryOption } from '../../types/deliveryOption';
import { Coupon } from '../../types/coupon';
import { MealPlan } from '../../types/mealPlan';
import { FamilyMember } from '../../types/familyMember';
import { ProteinPlan } from '../../types/proteinPlan';

interface CartItem {
  planDuration: 1 | 2 | 4;
  selectedWeeks: SelectedWeek[];
  activeWeek: SelectedWeek | null;
  selectedPlan: MealPlan | null;
  selectedFamilyMemberId: string | null;
  selectedFamilyMember: FamilyMember | null;
  orderItems: PendingOrderItem[];
  orderNotes: string;
  selectedDeliveryOption: DeliveryOption | null;
  appliedCoupon: Coupon | null;
  couponDiscountAmount: number;
  paymentIntentId?: string;
  clientSecret?: string;
}

export interface ProteinCartItem {
  proteinPlan: ProteinPlan;
  quantity: number;
}

interface CartContextType {
  cart: CartItem | null;
  addToCart: (item: CartItem) => void;
  updateCart: (item: Partial<CartItem>) => void;
  clearCart: () => void;
  setPaymentInfo: (paymentIntentId: string, clientSecret: string) => void;
  itemCount: number;
  hasItems: boolean;
  proteinCart: ProteinCartItem[];
  addProteinToCart: (item: ProteinCartItem) => void;
  removeProteinFromCart: (proteinPlanId: string) => void;
  clearProteinCart: () => void;
  proteinItemCount: number;
  hasProteinItems: boolean;
  proteinSubtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'holadieta_customer_cart';
const PROTEIN_CART_STORAGE_KEY = 'holadieta_protein_cart';

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cart, setCart] = useState<CartItem | null>(null);
  const [proteinCart, setProteinCart] = useState<ProteinCartItem[]>([]);

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      localStorage.removeItem(CART_STORAGE_KEY);
    }

    try {
      const storedProteinCart = localStorage.getItem(PROTEIN_CART_STORAGE_KEY);
      if (storedProteinCart) {
        setProteinCart(JSON.parse(storedProteinCart));
      }
    } catch (error) {
      console.error('Error loading protein cart from localStorage:', error);
      localStorage.removeItem(PROTEIN_CART_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      if (cart) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cart]);

  useEffect(() => {
    try {
      if (proteinCart.length > 0) {
        localStorage.setItem(PROTEIN_CART_STORAGE_KEY, JSON.stringify(proteinCart));
      } else {
        localStorage.removeItem(PROTEIN_CART_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error saving protein cart to localStorage:', error);
    }
  }, [proteinCart]);

  const addToCart = (item: CartItem) => {
    setCart(item);
  };

  const updateCart = (updates: Partial<CartItem>) => {
    if (cart) {
      setCart({ ...cart, ...updates });
    }
  };

  const clearCart = () => {
    setCart(null);
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const setPaymentInfo = (paymentIntentId: string, clientSecret: string) => {
    if (cart) {
      setCart({ ...cart, paymentIntentId, clientSecret });
    }
  };

  const addProteinToCart = (item: ProteinCartItem) => {
    setProteinCart(prev => {
      const existing = prev.find(p => p.proteinPlan.id === item.proteinPlan.id);
      if (existing) {
        return prev.map(p =>
          p.proteinPlan.id === item.proteinPlan.id
            ? { ...p, quantity: p.quantity + item.quantity }
            : p
        );
      }
      return [...prev, item];
    });
  };

  const removeProteinFromCart = (proteinPlanId: string) => {
    setProteinCart(prev => prev.filter(p => p.proteinPlan.id !== proteinPlanId));
  };

  const clearProteinCart = () => {
    setProteinCart([]);
    localStorage.removeItem(PROTEIN_CART_STORAGE_KEY);
  };

  const itemCount = cart?.orderItems.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const proteinItemCount = proteinCart.reduce((sum, item) => sum + item.quantity, 0);
  const hasItems = itemCount > 0 || proteinItemCount > 0;
  const hasProteinItems = proteinItemCount > 0;
  const proteinSubtotal = proteinCart.reduce(
    (sum, item) => sum + item.proteinPlan.protein_plans_price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateCart,
        clearCart,
        setPaymentInfo,
        itemCount,
        hasItems,
        proteinCart,
        addProteinToCart,
        removeProteinFromCart,
        clearProteinCart,
        proteinItemCount,
        hasProteinItems,
        proteinSubtotal
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
