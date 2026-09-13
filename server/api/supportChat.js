const router = require('express').Router();
const JwtUtil = require('../utils/JwtUtil');
const service = require('../services/SupportChatService');
router.use(async (req, res, next) => {
  try { req.chatActor = await service.authenticate(JwtUtil.extractToken(req)); next(); }
  catch (error) { res.status(error.status || 503).json({ success: false, message: 'Không thể truy cập phiên hỗ trợ.' }); }
});
router.get('/current', async (req, res) => {
  try { res.json({ request: await service.current(req.chatActor) }); }
  catch (error) { res.status(error.status || 503).json({ message: 'Không tải được phiên hỗ trợ.' }); }
});
router.get('/:id/status', async (req, res) => {
  try { res.json({ request: service.view(await service.authorize(req.chatActor, req.params.id)) }); }
  catch (error) { res.status(error.status || 503).json({ message: 'Không tải được trạng thái hỗ trợ.' }); }
});
router.get('/:id/messages', async (req, res) => {
  try { res.json(await service.history(req.chatActor, req.params.id, req.query.before)); }
  catch (error) { res.status(error.status || 503).json({ message: 'Không tải được lịch sử hỗ trợ.' }); }
});
module.exports = router;
