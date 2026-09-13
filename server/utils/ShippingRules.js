const SHIPPING_FEE = 30000;
const FREE_SHIPPING_THRESHOLD = 1500000;

function calculateShippingFee(subtotal) {
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  return safeSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

module.exports = { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, calculateShippingFee };
