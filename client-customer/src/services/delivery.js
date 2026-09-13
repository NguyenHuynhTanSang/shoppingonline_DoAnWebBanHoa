export const DELIVERY_TIME_SLOTS = ['08:00-12:00', '12:00-17:00', '17:00-20:00'];
export const CARD_MESSAGE_LIMIT = 300;

export function vietnamToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function deliveryError({ deliveryDate, deliveryTimeSlot, cardMessage }) {
  const parsed = new Date(`${deliveryDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== deliveryDate) return 'Vui lòng chọn ngày giao hoa hợp lệ.';
  if (deliveryDate < vietnamToday()) return 'Ngày giao hoa không được ở trong quá khứ.';
  if (!DELIVERY_TIME_SLOTS.includes(deliveryTimeSlot)) return 'Vui lòng chọn khung giờ giao mong muốn.';
  if (cardMessage.trim().length > CARD_MESSAGE_LIMIT) return `Lời nhắn thiệp không được quá ${CARD_MESSAGE_LIMIT} ký tự.`;
  return '';
}
