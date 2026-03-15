export interface OrderTotals {
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
}

export const calculateTotals = (
  items: { price: number; quantity: number }[],
  options: { taxRate?: number; shippingFee?: number; discount?: number } = {}
): OrderTotals => {
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const taxTotal = subtotal * (options.taxRate || 0);
  const shippingTotal = options.shippingFee || 0;
  const discountTotal = options.discount || 0;
  const total = subtotal + taxTotal + shippingTotal - discountTotal;

  return {
    subtotal,
    taxTotal,
    shippingTotal,
    discountTotal,
    total,
  };
};
