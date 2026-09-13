const PaymentPolicy = require('../../utils/PaymentPolicy');
const OrderDAO = require('../../models/OrderDAO');
const CustomerDAO = require('../../models/CustomerDAO');

const statuses = {
  pending: 'Chờ xác nhận', approved: 'Đã xác nhận', preparing: 'Đang chuẩn bị',
  delivering: 'Đang giao', completed: 'Hoàn thành', canceled: 'Đã hủy'
};

function parseOrderLookup(message, context = {}) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const ids = message.match(/\b[a-f\d]{24}\b/gi) || [];
  if (/[$<>{}\[\]\\]/.test(text) || ids.length > 1) return { clarification: 'Vui lòng cung cấp một mã đơn đầy đủ, không dùng bộ lọc hoặc biểu thức truy vấn.' };
  if (ids.length === 1) return { orderId: ids[0] };
  if (/#|\bma don\b|\bdon\s+[a-z0-9]*\d[a-z0-9]*\b/.test(text)) return { clarification: 'Mã đơn hiện tại gồm 24 ký tự từ mục Đơn hàng của tôi. Vui lòng kiểm tra lại mã.' };
  if (/don (?:do|nay)|don truoc do/.test(text)) {
    if (!context.lastOrderId) return { clarification: 'Bạn muốn xem đơn nào? Hãy nêu mã đơn đầy đủ hoặc yêu cầu đơn gần nhất.' };
    return /truoc do/.test(text) ? { beforeOrderId: context.lastOrderId, latest: true } : { orderId: context.lastOrderId };
  }
  const params = {};
  if (/gan nhat|gan day nhat|moi nhat/.test(text)) params.latest = true;
  if (/bao nhieu don|so don/.test(text)) params.count = true;
  if (/dang xu ly/.test(text)) params.statuses = ['pending', 'approved', 'preparing', 'delivering'];
  else {
    const filters = [['cho xac nhan', 'pending'], ['da xac nhan', 'approved'], ['dang chuan bi', 'preparing'], ['dang giao', 'delivering'], ['hoan thanh', 'completed'], ['da huy', 'canceled']];
    const found = filters.find(([phrase]) => text.includes(phrase));
    if (found) params.statuses = [found[1]];
  }
  if (/hom qua/.test(text)) {
    const day = 86400000, offset = 7 * 3600000;
    params.to = Math.floor((Date.now() + offset) / day) * day - offset;
    params.from = params.to - day;
  }
  return params;
}

function responseTopics(message) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  if (/toan bo|day du|chi tiet/.test(text)) return ['status', 'total', 'payment', 'date', 'items'];
  const topics = [];
  if (/tong|bao nhieu tien|het bao nhieu/.test(text)) topics.push('total');
  if (/thanh toan|tra tien|phuong thuc|cod/.test(text)) topics.push('payment');
  if (/khi nao|luc nao|ngay nao|ngay dat/.test(text) && !/giao|nhan hang/.test(text)) topics.push('date');
  if (/gom nhung gi|mua gi|san pham nao|gom gi/.test(text)) topics.push('items');
  if (/trang thai|sao roi|dau roi|giao chua/.test(text) || !topics.length) topics.push('status');
  return topics;
}

function formatOrder(order, topics) {
  return topics.map(topic => {
    if (topic === 'total') return order.total === null ? 'Mình chưa có thông tin xác nhận về tổng tiền đơn này.' : `Tổng đơn của bạn là ${order.total.toLocaleString('vi-VN')}đ.`;
    if (topic === 'date') return order.placedAt ? `Bạn đặt đơn này vào ${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(order.placedAt))} (giờ Việt Nam) nha.` : 'Mình chưa có thông tin xác nhận về ngày đặt đơn này.';
    if (topic === 'payment') {
      const recorded = order.paymentStatus;
      const label = recorded === 'paid' ? 'đã thanh toán' : recorded === 'unpaid' ? 'chưa thanh toán' : recorded;
      return (label ? `Thanh toán của đơn này đang được ghi nhận là “${label}”.` : 'Mình chưa có thông tin xác nhận về thanh toán của đơn này.') + (order.paymentMethod ? ` Phương thức bạn chọn là ${order.paymentMethod.toLowerCase()}.` : '');
    }
    if (topic === 'items') return order.items?.length ? 'Đơn này gồm:\n' + order.items.map(item => `• ${item.name}: ${item.quantity === null ? 'chưa rõ số lượng' : item.quantity}`).join('\n') + (order.moreItems ? '\nBạn xem mục Đơn hàng của tôi để thấy các sản phẩm còn lại nhé.' : '') : 'Mình chưa có thông tin sản phẩm được xác nhận cho đơn này.';
    return order.status === 'Chưa có thông tin xác nhận' ? 'Mình chưa có thông tin xác nhận về trạng thái đơn này.' : `Đơn của bạn hiện ${order.status.toLowerCase()} nha.`;
  }).join('\n');
}

async function getOrderStatus(decoded, message, context) {
  const response = (status, reply, orders = [], total = null) => ({ status, body: { reply, type: 'order_status', products: [], order: orders.length === 1 ? orders[0] : null, orders, total } });
  // Identity comes only from the verified customer JWT, never request body fields.
  if (decoded?.role !== 'customer' || typeof decoded.sub !== 'string' || !/^[a-f\d]{24}$/i.test(decoded.sub)) {
    return response(403, 'Chỉ tài khoản khách hàng được tra cứu đơn của chính mình.');
  }
  const customer = await CustomerDAO.selectByID(decoded.sub);
  if (!customer || Number(customer.active) !== 1) return response(403, 'Tài khoản khách hàng chưa hoạt động hoặc đã bị khóa.');
  const input = parseOrderLookup(message, context);
  if (input.clarification) return response(200, input.clarification);
  const result = await OrderDAO.lookupForAssistant(decoded.sub, input);
  const topics = responseTopics(message);
  const orders = result.orders.map(order => {
  const date = typeof order.cdate === 'number' ? new Date(order.cdate) : null;
  const status = String(order.status).toLowerCase();
  const methods = { cod: 'Thanh toán khi nhận hàng', bank: 'Chuyển khoản ngân hàng', momo: 'Ví điện tử MoMo' };
  return {
    id: String(order._id),
    status: Object.hasOwn(statuses, status) ? statuses[status] : 'Chưa có thông tin xác nhận',
    placedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    paymentStatus: typeof order.paymentStatus === 'string' ? require('./HandoffService').safeMessage(PaymentPolicy.displayStatus(order.paymentStatus)).slice(0, 200) : null,
    total: Number.isFinite(order.total) && order.total >= 0 ? order.total : null,
    paymentMethod: Object.hasOwn(methods, order.customerInfo?.paymentMethod) ? methods[order.customerInfo.paymentMethod] : null,
    ...(topics.includes('items') ? {
      items: (Array.isArray(order.items) ? order.items : []).slice(0, 20).filter(item => typeof item?.product?.name === 'string' && item.product.name.trim()).map(item => ({ name: require('./HandoffService').safeMessage(item.product.name).slice(0, 200), quantity: Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : null })),
      moreItems: Array.isArray(order.items) && order.items.length > 20
    } : {})
  };
  });
  if (context) context.lastOrderId = orders.length === 1 ? orders[0].id : null;
  if (!orders.length) return response(200, 'Mình chưa tìm thấy đơn hàng phù hợp của bạn.', [], result.total);
  const prefix = input.count ? `Bạn có ${result.total} đơn phù hợp. Dưới đây là ${orders.length} đơn gần nhất nhé.\n` : orders.length > 1 ? 'Mình tìm thấy các đơn gần đây này. Bạn chọn mã đơn muốn xem thêm nhé.\n' : '';
  return response(200, prefix + orders.map(order => (orders.length > 1 || topics.length === 5 ? `Đơn #${order.id}\n` : '') + formatOrder(order, topics)).join('\n\n'), orders, result.total);
}

module.exports = { getOrderStatus, parseOrderLookup };
