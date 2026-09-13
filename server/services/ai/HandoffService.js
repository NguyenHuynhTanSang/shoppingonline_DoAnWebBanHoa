function detectHandoff(message) {
  if (typeof message !== 'string') return null;
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  if (/chinh sach|quy dinh|dieu kien|thu tuc/.test(text) && !/toi muon|toi can|don cua|shop giao/.test(text)) return null;
  const rules = [
    ['wrong_product', /giao (?:sai|nham)|sai (?:hoa|san pham)|(?:hoa|san pham).*khong giong mo ta/],
    ['damaged_product', /hu hong|dap nat|bi dap|bi heo|hoa heo|bi hong/],
    ['refund', /(?:muon|can|yeu cau|xin|hay|giup|ho tro).*hoan tien|refund|hoan tien (?:cho|giup)/],
    ['delivery', /khieu nai.*giao|giao (?:tre|cham)|giao (?:hang )?that bai|chua nhan.*(?:hoa|hang)/],
    ['payment', /thanh toan.*(?:loi|van de|that bai)|tru tien|chuyen khoan.*(?:loi|nham)/],
    ['staff', /gap.*(?:nhan vien|nguoi that)|noi chuyen.*nhan vien|can nhan vien/],
    ['order_change', /(?:muon|can|hay|giup|yeu cau).*(?:huy don|doi dia chi|sua don)|(?:huy don|doi dia chi|sua don).*giup (?:toi|minh)/]
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function safeMessage(message) {
  return message.replace(/mongodb(?:\+srv)?:\/\/\S+|https?:\/\/[^\s/]+:[^\s@]+@\S+/gi, '[credential đã ẩn]')
    .replace(/\b(?:Bearer\s+\S+|gsk_\S+|sk-\S+|eyJ[\w.-]+)\b/gi, '[đã ẩn]')
    .replace(/(?:authorization|jwt|token|secret|password|mat khau|mật khẩu|api[_ -]?key|otp|cvv)\s*[:=]?\s*\S+/gi, '[đã ẩn]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email đã ẩn]')
    .replace(/\b\d[\d -]{7,}\d\b/g, '[số đã ẩn]').slice(0, 2000);
}

async function createHandoff(decoded, message, context) {
  const reply = (status, text, extra = {}) => ({ status, body: {
    reply: text, type: 'human_handoff', products: [], needsHumanSupport: true, supportRequestId: null, ...extra
  } });
  if (typeof message !== 'string' || !message.trim() || message.length > 2000 ||
      (context !== undefined && (typeof context !== 'string' || context.length > 2000 || !detectHandoff(context)))) {
    return reply(400, 'Thông tin yêu cầu hỗ trợ không hợp lệ.');
  }
  const category = detectHandoff(message) || detectHandoff(context);
  if (!category) return reply(400, 'Vui lòng mô tả vấn đề cần nhân viên hỗ trợ.');
  if (decoded?.role !== 'customer' || typeof decoded.sub !== 'string' || !/^[a-f\d]{24}$/i.test(decoded.sub)) return reply(403, 'Vui lòng dùng tài khoản khách hàng để gửi yêu cầu hỗ trợ.');
  try {
    const CustomerDAO = require('../../models/CustomerDAO');
    const OrderDAO = require('../../models/OrderDAO');
    const SupportRequestDAO = require('../../models/SupportRequestDAO');
    const customer = await CustomerDAO.selectByID(decoded.sub);
    if (!customer || Number(customer.active) !== 1) return reply(403, 'Tài khoản chưa hoạt động hoặc đã bị khóa.');
    const combined = context ? `${context}\n${message}` : message;
    const ids = [...new Set((combined.match(/\b[a-f\d]{24}\b/gi) || []).map(id => id.toLowerCase()))];
    if (ids.length > 1 || (category !== 'staff' && ids.length !== 1)) {
      return reply(200, 'Mình rất tiếc về sự cố này. Vui lòng cung cấp một mã đơn đầy đủ để tạo yêu cầu hỗ trợ. Chưa có yêu cầu nào được tạo.', { type: 'human_handoff_required', supportContext: safeMessage(context || message) });
    }
    const orderId = ids[0] || null;
    if (orderId && !await OrderDAO.selectStatusForCustomer(orderId, decoded.sub)) return reply(200,
      'Không tìm thấy đơn trong tài khoản của bạn. Vui lòng kiểm tra mã đơn; chưa có yêu cầu nào được tạo.',
      { type: 'human_handoff_required', supportContext: safeMessage((context || message).replace(/\b[a-f\d]{24}\b/gi, '')) });
    const existing = await SupportRequestDAO.selectOpen({ customerId: decoded.sub, orderId, category });
    if (existing?._id) return reply(200,
      `Yêu cầu hỗ trợ #${existing._id} cho vấn đề này đã được ghi nhận và đang chờ xử lý. Mình không tạo thêm yêu cầu trùng. AI chưa hoàn tiền hoặc thay đổi đơn hàng.`,
      { supportRequestId: String(existing._id) });
    const saved = await SupportRequestDAO.insert({ customerId: decoded.sub, orderId, category,
      customerMessage: safeMessage(combined.replace(/\b[a-f\d]{24}\b/gi, '[mã đơn]')) });
    if (!saved?._id) throw new Error('Support creation failed');
    // A notification failure must not turn a committed request into a creation failure.
    require('../../realtime/supportChat').publishAdmins('support:new', { _id: saved._id, status: 'pending', category }).catch(() => {});
    return reply(200, `Mình đã ghi nhận yêu cầu hỗ trợ #${saved._id} để nhân viên Wind Flower kiểm tra. AI chưa thực hiện hoàn tiền hoặc thay đổi đơn hàng.`, { supportRequestId: String(saved._id) });
  } catch {
    return reply(503, 'Chưa thể tạo hoặc chuyển yêu cầu hỗ trợ. Vui lòng thử lại sau.', { supportContext: safeMessage(context || message) });
  }
}

module.exports = { detectHandoff, createHandoff, safeMessage };
