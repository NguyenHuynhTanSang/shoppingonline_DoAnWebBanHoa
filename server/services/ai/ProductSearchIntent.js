// Bounded, deterministic search grammar. No execution of model/client-supplied code.
function parseProductSearch(message) {
  message = message.replace(/^(?:shop\s+)?có\s+(hoa\b)/i, 'Tìm $1').replace(/\s+không\s*[?!.]*$/i, '');
  const text = message.trim().toLowerCase();
  const plain = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  if (!/(?:tim|mua|goi y|tu van|can|co ban).*(?:hoa|san pham)|(?:hoa|san pham).*(?:duoi|tu |gia|con hang)/.test(plain)) return null;
  const clarify = { clarification: 'Vui lòng nêu từ khóa hoa và ngân sách rõ ràng, ví dụ: Tìm hoa tulip từ 1 triệu đến 2 triệu.' };
  if (/[$<>{}\[\]\\]|\b(?:khong|tru|ngoai tru)\b/.test(plain)) return clarify;
  const params = { inStockOnly: true, limit: 4 };
  // Unit is required to avoid guessing whether "1" means one dong or one million.
  const amount = '(\\d+(?:[.,]\\d+)?)\\s*(trieu|tr|nghin|ngan|k|dong|vnd)';
  const range = new RegExp(`\\btu\\s+${amount}\\s+den\\s+${amount}\\b`);
  const upper = new RegExp(`(?:duoi|toi da|khong qua|khoang|ngan sach)\\s+${amount}\\b`);
  const lower = new RegExp(`(?:tu|it nhat)\\s+${amount}\\b`);
  const money = (value, unit) => Number(value.replace(',', '.')) *
    (['trieu', 'tr'].includes(unit) ? 1000000 : ['nghin', 'ngan', 'k'].includes(unit) ? 1000 : 1);
  let match = plain.match(range);
  if (match) {
    params.minPrice = money(match[1], match[2]);
    params.maxPrice = money(match[3], match[4]);
  } else if ((match = plain.match(upper))) params.maxPrice = money(match[1], match[2]);
  else if ((match = plain.match(lower))) params.minPrice = money(match[1], match[2]);
  if ((params.minPrice !== undefined && !Number.isSafeInteger(params.minPrice)) ||
      (params.maxPrice !== undefined && !Number.isSafeInteger(params.maxPrice)) ||
      params.minPrice > params.maxPrice) return clarify;
  // Strip the matching budget span from the original accented text using normalized word counts.
  let keyword = text;
  if (match) {
    const beforeWords = plain.slice(0, match.index).trim().split(/\s+/).filter(Boolean).length;
    const budgetWords = match[0].trim().split(/\s+/).length;
    const words = text.split(/\s+/);
    words.splice(beforeWords, budgetWords);
    keyword = words.join(' ');
  }
  keyword = keyword.replace(/^(?:tôi\s+)?(?:tìm|mua|gợi ý|tư vấn|cần|có bán)\s*/i, '')
    .replace(/^(?:tư vấn\s+)?(?:sản phẩm|hoa)\s*/i, '').replace(/[?!.]+$/g, '').trim();
  if (/\d/.test(keyword) || /(?:den|duoi|ngan sach|toi da)\b/.test(keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || keyword.length > 200) return clarify;
  if (keyword) params.keyword = keyword;
  return { params };
}

module.exports = { parseProductSearch };
