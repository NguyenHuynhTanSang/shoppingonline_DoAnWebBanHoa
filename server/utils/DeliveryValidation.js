const DELIVERY_TIME_SLOTS = Object.freeze(['08:00-12:00', '12:00-17:00', '17:00-20:00']);
const CARD_MESSAGE_LIMIT = 300;

function vietnamToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateDelivery(input, now = new Date()) {
  if (!isCalendarDate(input.deliveryDate)) return { message: 'Vui lòng chọn ngày giao hoa hợp lệ.' };
  if (input.deliveryDate < vietnamToday(now)) return { message: 'Ngày giao hoa không được ở trong quá khứ.' };
  if (!DELIVERY_TIME_SLOTS.includes(input.deliveryTimeSlot)) return { message: 'Vui lòng chọn khung giờ giao mong muốn hợp lệ.' };
  if (input.cardMessage !== undefined && typeof input.cardMessage !== 'string') return { message: 'Lời nhắn thiệp phải là văn bản.' };
  const cardMessage = (input.cardMessage || '').trim();
  if (cardMessage.length > CARD_MESSAGE_LIMIT) return { message: `Lời nhắn thiệp không được quá ${CARD_MESSAGE_LIMIT} ký tự.` };
  return { value: { deliveryDate: input.deliveryDate, deliveryTimeSlot: input.deliveryTimeSlot, cardMessage } };
}

module.exports = { DELIVERY_TIME_SLOTS, CARD_MESSAGE_LIMIT, isCalendarDate, vietnamToday, validateDelivery };
