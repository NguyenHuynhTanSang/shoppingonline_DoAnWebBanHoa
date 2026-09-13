const router = require('express').Router();
const JwtUtil = require('../utils/JwtUtil');
const Models = require('../models/Models');
const DAO = require('../models/SupportRequestDAO');
const isId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const categories = ['wrong_product', 'damaged_product', 'refund', 'delivery', 'payment', 'staff', 'order_change'];
const fail = res => res.status(500).json({ success: false, message: 'Không thể xử lý yêu cầu hỗ trợ lúc này.' });

router.use(JwtUtil.checkToken, JwtUtil.requireRoles(['admin', 'staff']), async (req, res, next) => {
  try {
    if (!isId(req.decoded.sub)) return res.status(403).json({ success: false, message: 'Tài khoản không hợp lệ.' });
    const model = req.decoded.role === 'admin' ? Models.Admin : Models.Staff;
    const actor = await model.findById(req.decoded.sub).select('username name active').lean().exec();
    if (!actor || (req.decoded.role === 'staff' && Number(actor.active) !== 1)) return res.status(403).json({ success: false, message: 'Tài khoản không được phép truy cập.' });
    req.supportActor = { id: req.decoded.sub, role: req.decoded.role, name: actor.name || actor.username || '' };
    next();
  } catch { return fail(res); }
});

router.get('/', async (req, res) => {
  const { status = '', category = '', search = '', sort = 'newest', page = '1' } = req.query;
  if (Object.keys(req.query).some(key => !['status', 'category', 'search', 'sort', 'page'].includes(key)) ||
      !['', 'pending', 'in_progress', 'resolved'].includes(status) || !['', ...categories].includes(category) ||
      typeof search !== 'string' || search.length > 100 || !['newest', 'oldest'].includes(sort) ||
      typeof page !== 'string' || !/^[1-9]\d{0,4}$/.test(page)) return res.status(400).json({ success: false, message: 'Bộ lọc không hợp lệ.' });
  try { res.json({ success: true, ...await DAO.list({ status, category, search: search.trim(), sort, page: Number(page) }) }); }
  catch { return fail(res); }
});

router.get('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Mã yêu cầu không hợp lệ.' });
  try {
    const request = await DAO.detail(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu.' });
    res.json({ success: true, request });
  } catch { return fail(res); }
});

router.patch('/:id/status', async (req, res) => {
  if (!isId(req.params.id) || !req.body || Object.keys(req.body).some(key => key !== 'status') ||
      !['in_progress', 'resolved'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Thao tác không hợp lệ.' });
  try {
    const request = await DAO.transition(req.params.id, req.body.status, req.supportActor);
    if (!request) return res.status(409).json({ success: false, message: 'Yêu cầu không tồn tại hoặc trạng thái đã thay đổi. Vui lòng tải lại.' });
    // Status notification failure must not report a committed transition as failed.
    require('../realtime/supportChat').publish(req.params.id, 'support:status', { id: req.params.id, status: request.status }).catch(() => {});
    require('../realtime/supportChat').publishAdmins('support:updated', request).catch(() => {});
    res.json({ success: true, request });
  } catch { return fail(res); }
});
module.exports = router;
