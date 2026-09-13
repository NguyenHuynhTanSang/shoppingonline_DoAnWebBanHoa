const router = require('express').Router();
const { answerFAQ, isPolicyQuestion, policyQuery, validateMessage } = require('../services/ai/FAQService');

router.post('/chat', async (req, res) => {
  try {
    // Validate before intent detection, including the shared message length bound.
    validateMessage(req.body?.message);
    const message = req.body.message;
    const memory = req.body.memory === true || req.body.conversationId !== undefined;
    if ((req.body.memory !== undefined && typeof req.body.memory !== 'boolean') ||
      (req.body.conversationId !== undefined && (typeof req.body.conversationId !== 'string' || !/^[a-f\d]{64}$/.test(req.body.conversationId)))) {
      return res.status(400).json({ reply: 'Thông tin cuộc trò chuyện không hợp lệ.', type: 'error', products: [], code: 'INVALID_CONVERSATION' });
    }
    let chatActor;
    const authToken = req.headers['x-access-token'] || req.headers.authorization;
    const humanResponse = request => ({ reply: 'Nhân viên Wind Flower đang hỗ trợ. Vui lòng gửi tin nhắn qua phiên hỗ trợ.', type: 'human_active', products: [], supportRequestId: request.id });
    if (authToken) {
      const supportChat = require('../services/SupportChatService');
      chatActor = await supportChat.authenticate(require('../utils/JwtUtil').extractToken(req));
      const active = await supportChat.active(chatActor);
      if (active) return res.json(humanResponse(active));
      if (memory) {
        const current = await supportChat.current(chatActor);
        if (current?.status === 'pending') return res.json({ ...humanResponse(current), type: 'human_waiting', reply: 'Yêu cầu của bạn đang chờ nhân viên tiếp nhận.' });
      }
    }
    const store = memory ? require('../services/ai/ConversationStore') : null;
    let context;
    async function loadContext() {
      if (store && !context) context = await store.load(req.body.conversationId, chatActor);
      return context;
    }
    async function finishAnswer(answer) {
      if (chatActor) {
        const support = require('../services/SupportChatService');
        const active = await support.active(chatActor);
        if (active) return res.json(humanResponse(active));
        if (memory) {
          const current = await support.current(chatActor);
          if (current?.status === 'pending') return res.json({ ...humanResponse(current), type: 'human_waiting' });
        }
      }
      if (store) answer.conversationId = await store.save(context);
      return res.json(answer);
    }
    if (req.body.supportContext === undefined && isPolicyQuestion(message)) {
      await loadContext();
      return await finishAnswer(answerFAQ(message, context));
    }
    if (/shop bao.*doi.*don|tranh chap.*chinh sach/i.test(message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd'))) {
      return res.json({ reply: 'Trường hợp này cần nhân viên Wind Flower kiểm tra trực tiếp. Bạn có thể yêu cầu gặp nhân viên để tạo yêu cầu hỗ trợ nhé; mình chưa chuyển yêu cầu hoặc thay đổi đơn hàng.', type: 'general', products: [] });
    }
    const { detectHandoff, createHandoff } = require('../services/ai/HandoffService');
    if (detectHandoff(message) || req.body.supportContext !== undefined) {
      const JwtUtil = require('../utils/JwtUtil');
      const authResponse = {
        status() { return this; },
        json() { return res.status(401).json({ reply: 'Vui lòng đăng nhập để tạo yêu cầu hỗ trợ.', type: 'auth_required', products: [], needsHumanSupport: true, supportRequestId: null }); }
      };
      return JwtUtil.checkToken(req, authResponse, async () => {
        const result = await createHandoff(req.decoded, message, req.body.supportContext);
        return res.status(result.status).json(result.body);
      });
    }
    const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
    await loadContext();
    if (policyQuery(message, context)) return await finishAnswer(answerFAQ(message, context));
    if (context) context.lastPolicyTopic = null;
    if (/^(?:huy don|hoan tien)/.test(text.trim())) return res.json({ reply: 'Mình chưa thể tự hủy đơn hoặc hoàn tiền giúp bạn. Bạn có thể yêu cầu gặp nhân viên Wind Flower để được hỗ trợ nhé.', type: 'general', products: [] });
    const lookup = /\b[a-f\d]{24}\b/i.test(message) ||
      /(?:trang thai|tra cuu|kiem tra|theo doi|ma don|don hang cua|don cua|don.*(?:den dau|o dau|giao chua))/.test(text) ||
      /\bdon\b(?! gian)|\borders?\b/.test(text);
    if (lookup) {
      const JwtUtil = require('../utils/JwtUtil');
      const authResponse = {
        status() { return this; },
        json() { return res.status(401).json({ reply: 'Bạn đăng nhập trước nhé, sau đó mình có thể kiểm tra đơn hàng giúp bạn.', type: 'auth_required', products: [] }); }
      };
      return JwtUtil.checkToken(req, authResponse, async () => {
        try {
          const { getOrderStatus } = require('../services/ai/OrderStatusService');
          if (req.body.orderId !== undefined && (typeof req.body.orderId !== 'string' || !/^[a-f\d]{24}$/i.test(req.body.orderId))) return res.status(400).json({ reply: 'Mã đơn không hợp lệ.', type: 'error', products: [] });
          const result = await getOrderStatus(req.decoded, message, context);
          if (result.status === 200 && result.body.order && /huy don|huy khong|duoc huy/.test(text)) {
            result.body.reply += '\n' + answerFAQ('Hủy đơn được không?').reply;
          }
          const support = require('../services/SupportChatService');
          const active = await support.active(chatActor);
          if (active) return res.json(humanResponse(active));
          if (store && result.status === 200) {
            const current = await support.current(chatActor);
            if (current?.status === 'pending') return res.json({ ...humanResponse(current), type: 'human_waiting' });
            result.body.conversationId = await store.save(context);
          }
          return res.status(result.status).json(result.body);
        } catch {
          return res.status(503).json({ reply: 'Hiện mình chưa kiểm tra được đơn hàng. Bạn thử lại sau một chút nhé.', type: 'error', products: [] });
        }
      });
    }
    const { chat } = require('../services/ai/AIService');
    const answer = await chat(message, context);
    // Suppress an AI answer if acceptance happened while provider/search was running.
    if (chatActor) {
      const active = await require('../services/SupportChatService').active(chatActor);
      if (active) return res.json(humanResponse(active));
      if (memory) {
        const current = await require('../services/SupportChatService').current(chatActor);
        if (current?.status === 'pending') return res.json({ ...humanResponse(current), type: 'human_waiting', reply: 'Yêu cầu của bạn đang chờ nhân viên tiếp nhận.' });
      }
    }
    if (store) answer.conversationId = await store.save(context);
    res.json(answer);
  } catch (error) {
    if (['INVALID_CONVERSATION', 'CONVERSATION_UNAVAILABLE', 'CONVERSATION_CONFLICT'].includes(error.code)) return res.status(error.status || 503).json({ reply: 'Chưa thể lưu hoặc tải context cuộc trò chuyện. Vui lòng gửi lại câu hỏi.', type: 'error', products: [], code: error.code });
    if (['AUTH_REQUIRED', 'FORBIDDEN'].includes(error.code)) return res.status(error.status || 403).json({ reply: 'Vui lòng kiểm tra tài khoản đăng nhập.', type: 'auth_required', products: [] });
    const invalid = error.code === 'INVALID_MESSAGE';
    if (error.code === 'INVALID_PRODUCT_SEARCH_INPUT' || error.code === 'PRODUCT_SEARCH_UNAVAILABLE') {
      return res.status(error.code === 'INVALID_PRODUCT_SEARCH_INPUT' ? 400 : 503).json({
        reply: 'Chưa thể tìm sản phẩm theo yêu cầu. Vui lòng thử lại hoặc điều chỉnh tiêu chí.',
        type: 'error', products: [], code: error.code
      });
    }
    const providerFailure = ['GROQ_NOT_CONFIGURED', 'GROQ_MODEL_MISSING', 'GROQ_RATE_LIMIT', 'GROQ_TIMEOUT', 'GROQ_PROVIDER_ERROR', 'GROQ_INVALID_RESPONSE', 'GROQ_NETWORK_ERROR'].includes(error.code);
    res.status(invalid ? 400 : providerFailure ? error.status : 500).json({
      reply: invalid || providerFailure ? error.message : 'Wind Flower AI tạm thời chưa thể trả lời. Vui lòng thử lại sau.',
      type: 'error',
      products: [],
      code: invalid || providerFailure ? error.code : 'AI_ERROR'
    });
  }
});

module.exports = router;
