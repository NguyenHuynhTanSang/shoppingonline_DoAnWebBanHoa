const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { lookupShopPolicy } = require('../services/ai/FAQService');
const { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, calculateShippingFee } = require('../utils/ShippingRules');
const { DELIVERY_TIME_SLOTS } = require('../utils/DeliveryValidation');

test('canonical lookup answers required policy variants with stable keys', () => {
  for (const [query, key, expected] of [
    ['Phí giao hàng bao nhiêu?', 'shipping.fee', /30.000đ/],
    ['Đơn bao nhiêu thì được miễn ship?', 'shipping.free_shipping', /trước voucher từ 1.500.000đ/],
    ['Giao trong ngày được không?', 'shipping.same_day', /15:00/],
    ['Đặt mấy giờ thì không giao hôm nay nữa?', 'shipping.cutoff', /ngày tiếp theo/],
    ['Shop giao đúng 18:00 không?', 'shipping.time_slots', /không cam kết/],
    ['Không gọi được người nhận thì sao?', 'shipping.recipient_absent', /liên hệ người đặt/],
    ['Giao lại mất bao nhiêu?', 'shipping.redelivery', /30.000đ/],
    ['Lỗi shop mà phải giao lại thì sao?', 'shipping.redelivery', /không thu thêm phí/],
    ['Hoa bị dập thì sao?', 'returns.damaged_product', /kiểm tra trường hợp cụ thể/],
    ['Hủy đơn giúp tôi', 'order.cancel', /không hủy đơn/],
    ['Hoàn tiền trong mấy ngày?', 'refund.general', /Chưa có thông tin xác nhận/],
    ['Shop nhận COD không?', 'payment.cod', /COD/]
  ]) {
    const result = lookupShopPolicy({ query });
    assert.equal(result.found, true, query);
    const policy = result.policies.find(policy => policy.key === key);
    assert.ok(policy, query); assert.match(policy.content, expected);
    assert.ok(policy.title && policy.sources.length);
    assert.equal(result.category, policy.category);
  }
  const slots = lookupShopPolicy({ query: 'Khung giờ giao?' }).policies[0].content;
  for (const slot of DELIVERY_TIME_SLOTS) assert.ok(slots.includes(slot));
});

test('unsupported, invalid, operator and category inputs never become database filters', () => {
  for (const query of ['Shop nhận Bitcoin không?', 'Shop giao bằng trực thăng không?', 'codex', 'COD {$ne:null}']) {
    assert.deepEqual(lookupShopPolicy({ query }), { found: false, category: null, policies: [] });
  }
  for (const input of [null, [], { query: { $ne: null } }, { query: 'COD', $where: 'x' }, { query: 'COD', topic: '$or' }, { query: 'COD', topic: {} }]) assert.throws(() => lookupShopPolicy(input));
  assert.equal(lookupShopPolicy({ query: 'COD', topic: 'shipping' }).found, false);
  assert.equal(lookupShopPolicy({ query: 'Phí ship', topic: 'shipping' }).category, 'shipping');
});

test('numeric sources agree with current frontend shipping calculation, content and slots', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '../../client-customer/src', file), 'utf8');
  const checkout = read('components/CheckoutComponent.js');
  const functionBody = checkout.match(/function getShippingFee\(subtotal\) \{([\s\S]*?)\n\}/)[1];
  const frontendFee = new Function('subtotal', functionBody);
  for (const subtotal of [0, FREE_SHIPPING_THRESHOLD - 1, FREE_SHIPPING_THRESHOLD, FREE_SHIPPING_THRESHOLD + 1]) assert.equal(frontendFee(subtotal), calculateShippingFee(subtotal));
  const shipping = read('components/ShippingPolicyComponent.js');
  const returns = read('components/ReturnPolicyComponent.js');
  assert.ok(shipping.includes(SHIPPING_FEE.toLocaleString('vi-VN') + 'đ'));
  assert.ok(shipping.includes(FREE_SHIPPING_THRESHOLD.toLocaleString('vi-VN') + 'đ'));
  assert.ok(returns.includes(SHIPPING_FEE.toLocaleString('vi-VN') + 'đ'));
  const knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, '../services/ai/knowledge/faq.json'), 'utf8'));
  assert.ok(shipping.includes(knowledge.rules.sameDayCutoff));
  const frontendSlots = JSON.parse(read('services/delivery.js').match(/DELIVERY_TIME_SLOTS = (\[[^;]+\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(frontendSlots, DELIVERY_TIME_SLOTS);
  assert.ok(knowledge.topics.every(topic => !/30\.000|1\.500\.000|15:00/.test(topic.answer)));
});
