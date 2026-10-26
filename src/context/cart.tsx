import { createContext, type ReactNode, use, useState } from 'react';

import { useAuth } from '@/context/auth';

type CartContextValue = {
  /** Quantity per SKU. */
  items: Record<string, number>;
  /** Total number of units in the cart. */
  count: number;
  add: (sku: string, quantity: number) => void;
  setQuantity: (sku: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Parts cart for ordering. Kept in memory and emptied when a different user signs in. */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const owner = user?.phone ?? null;
  const [cart, setCart] = useState<{ owner: string | null; items: Record<string, number> }>({
    owner,
    items: {},
  });
  const items = cart.owner === owner ? cart.items : {};

  // Functional updates, so several changes in a row (e.g. adding many items) all apply.
  const change = (sku: string, update: (current: number) => number) =>
    setCart((prev) => {
      const next = prev.owner === owner ? { ...prev.items } : {};
      const quantity = Math.min(update(next[sku] ?? 0), 999);
      if (quantity > 0) next[sku] = quantity;
      else delete next[sku];
      return { owner, items: next };
    });

  return (
    <CartContext
      value={{
        items,
        count: Object.values(items).reduce((sum, q) => sum + q, 0),
        add: (sku, quantity) => change(sku, (current) => current + quantity),
        setQuantity: (sku, quantity) => change(sku, () => quantity),
        clear: () => setCart({ owner, items: {} }),
      }}>
      {children}
    </CartContext>
  );
}

export function useCart() {
  const value = use(CartContext);
  if (!value) throw new Error('useCart must be used inside <CartProvider>');
  return value;
}
