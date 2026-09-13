const fs = require('fs');
const path = require('path');
const { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } = require('../../utils/ShippingRules');
const { DELIVERY_TIME_SLOTS } = require('../../utils/DeliveryValidation');
const categories = ['shopping', 'shipping', 'payment', 'returns', 'refund', 'cancellation', 'order_changes', 'contact', 'hours', 'voucher'];
const fallback = 'Mình chưa có thông tin xác nhận về chính sách này. Bạn có thể yêu cầu gặp nhân viên Wind Flower để được hỗ trợ nhé.';
const normalize = message => ` ${message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

function validateMessage(message) {
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
    const error = new Error('Vui lòng nhập câu hỏi từ 1 đến 2000 ký tự.');
    error.code = 'INVALID_MESSAGE';
    throw error;
  }
}
function isPolicyQuestion(message) {
  validateMessage(message);
  const text = normalize(message);
  if (/\b[a-f\d]{24}\b|don (?:hang )?(?:cua|do|nay)|don (?:gan|moi)|don toi|don minh/.test(text)) return false;
  if (/(?:hoa|san pham).*(?:toi|minh).*(?:nhan|bi|hu|dap)/.test(text)) return false;
  if (/gap.*nhan vien|giup toi|cho toi|toi (?:muon|can|yeu cau)|shop giao sai|khieu nai|tranh chap/.test(text)) return false;
  return /chinh sach|\bpolicy\b|\brefunds?\b|cutoff|bitcoin|momo|giao|ship|van chuyen|nhan duoc hoa|nhan hoa|cod\b|thanh toan|chuyen khoan|tra tien khi nhan|mo cua|dong cua|may gio|gio lam|lien he|hotline|email|dia chi|doi tra|doi hang|doi hoa|hoa.*\b(?:hu|dap)\b|hoan tien|huy don|voucher|bao hanh|khuyen mai|khong goi duoc nguoi nhan/.test(text);
}
function policyQuery(message, context) {
  validateMessage(message);
  const text = normalize(message);
  if (isPolicyQuestion(message)) return message;
  if (context?.lastPolicyTopic === 'shipping' && /^ con (?:don )?\d+(?: \d+)? (?:trieu|tr|k|nghin|ngan)\b/.test(text)) return 'Miễn ship';
  if (context?.lastPolicyTopic === 'shipping' && /^(?: con )? loi (?:shop|wind flower) thi sao /.test(text)) return 'Lỗi shop giao lại';
  return null;
}
function lookupShopPolicy(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    Object.keys(input).some(key => !['query', 'topic'].includes(key)) ||
    (input.topic !== undefined && ![...categories, 'delivery'].includes(input.topic))) {
    const error = new Error('Invalid policy lookup'); error.code = 'INVALID_POLICY_LOOKUP'; throw error;
  }
  validateMessage(input.query);
  const result = (policies = []) => ({ found: policies.length > 0,
    category: policies.length && policies.every(policy => policy.category === policies[0].category) ? policies[0].category : null,
    policies });
  try {
    const file = path.join(__dirname, 'knowledge', 'faq.json');
    if (fs.statSync(file).size > 65536) return { ...result(), unavailable: true };
    const knowledge = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(knowledge.topics) || knowledge.topics.length > 100) return { ...result(), unavailable: true };
    const text = normalize(input.query);
    // Unsupported means of payment/transport and query syntax are never inferred.
    if (/\$[a-z]+|[{}]/i.test(input.query) || /bitcoin|crypto|truc thang/.test(text)) return result();
    const category = input.topic === 'delivery' ? 'shipping' : input.topic;
    const matches = knowledge.topics.filter(topic => topic.isActive === true && typeof topic.id === 'string' &&
      typeof topic.answer === 'string' && topic.answer.trim() && topic.answer.length <= 2000 &&
      Array.isArray(topic.sources) && topic.sources.length && Array.isArray(topic.keywords) && topic.keywords.length <= 30 &&
      topic.keywords.every(keyword => typeof keyword === 'string' && keyword.length > 0 && keyword.length <= 100) &&
      (!category || (topic.category || topic.id) === category) &&
      topic.keywords.some(keyword => text.includes(normalize(keyword))));
    for (const topic of matches) if (knowledge.topics.some(other => other.isActive === true && other.id === topic.id && other.answer !== topic.answer)) return result();
    const grouped = new Map();
    for (const topic of matches) {
      const group = topic.category || topic.id;
      const previous = grouped.get(group);
      if (!previous || (topic.priority || 0) > (previous.priority || 0)) grouped.set(group, topic);
      else if ((topic.priority || 0) === (previous.priority || 0) && topic.answer !== previous.answer) return result();
    }
    const selected = [...grouped.values()];
    const addressChange = selected.find(topic => topic.category === 'order_changes');
    const values = { shippingFee: SHIPPING_FEE.toLocaleString('vi-VN') + 'đ', freeShippingThreshold: FREE_SHIPPING_THRESHOLD.toLocaleString('vi-VN') + 'đ',
      timeSlots: DELIVERY_TIME_SLOTS.join(', '), cutoff: knowledge.rules?.sameDayCutoff };
    const policies = (addressChange ? [addressChange] : selected.slice(0, 3)).map(topic => {
      const content = topic.answer.trim().replace(/\{\{(\w+)\}\}/g, (_, key) => {
        if (!Object.hasOwn(values, key) || typeof values[key] !== 'string') throw Error('Unknown policy value');
        return values[key];
      });
      return { key: topic.id, category: topic.category || topic.id, title: topic.title || topic.id, content, sources: [...topic.sources] };
    });
    return result(policies);
  } catch { return { ...result(), unavailable: true }; }
}
function answerFAQ(message, context) {
  validateMessage(message);
  try {
    const lookup = module.exports.lookupShopPolicy({ query: policyQuery(message, context) || message });
    if (context) context.lastPolicyTopic = lookup.category || null;
    const reply = lookup.unavailable ? 'Hiện mình chưa kiểm tra được chính sách này. Bạn thử lại sau một chút hoặc yêu cầu gặp nhân viên Wind Flower nhé.' : lookup.found ? lookup.policies.map(policy => policy.content
      .replace(/^Customer /, 'Bạn ')
      .replace(/^Phí giao hàng là /, 'Phí giao hàng hiện là ')
      .replace(/ Kiểm tra phí vận chuyển và tổng cộng tại checkout\.$/, '')
      .replace(/ Tool chỉ cung cấp chính sách, không hủy đơn\.$/, '')
      .replace(/ Bộ chọn ngày hiện chưa tự áp dụng cutoff này\.$/, '')).join('\n\n') : fallback;
    return { reply, type: 'faq', products: [] };
  } catch {
    if (context) context.lastPolicyTopic = null;
    return { reply: 'Hiện mình chưa kiểm tra được chính sách này. Bạn thử lại sau một chút hoặc yêu cầu gặp nhân viên Wind Flower nhé.', type: 'faq', products: [] };
  }
}
module.exports = { answerFAQ, lookupShopPolicy, isPolicyQuestion, policyQuery, validateMessage, fallback };
