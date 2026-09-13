const errors = {
  GROQ_NOT_CONFIGURED: [503, 'Wind Flower AI chưa được cấu hình API key.'],
  GROQ_MODEL_MISSING: [503, 'Wind Flower AI chưa được cấu hình GROQ_MODEL.'],
  GROQ_RATE_LIMIT: [429, 'Groq đang giới hạn lượt gọi. Vui lòng thử lại sau.'],
  GROQ_TIMEOUT: [504, 'Groq phản hồi quá thời gian. Vui lòng thử lại sau.'],
  GROQ_PROVIDER_ERROR: [502, 'Groq từ chối hoặc chưa thể xử lý yêu cầu. Vui lòng kiểm tra cấu hình provider.'],
  GROQ_INVALID_RESPONSE: [502, 'Groq trả về phản hồi không hợp lệ.'],
  GROQ_NETWORK_ERROR: [503, 'Chưa thể kết nối với Groq. Vui lòng thử lại sau.']
};

function providerError(code) {
  const error = new Error(errors[code][1]);
  error.code = code;
  error.status = errors[code][0];
  return error;
}

// Never log arbitrary provider text: it can echo credentials or customer input.
const diagnosticMessages = {
  model_not_found: 'Requested model does not exist or is not accessible.',
  model_decommissioned: 'Requested model has been retired.',
  invalid_api_key: 'Provider rejected the API credential.',
  invalid_request_error: 'Provider rejected request parameters.',
  authentication_error: 'Provider authentication failed.',
  permission_error: 'Provider denied access.',
  rate_limit_exceeded: 'Provider rate limit exceeded.',
  tokens: 'Provider token rate limit exceeded.',
  requests: 'Provider request rate limit exceeded.',
  insufficient_quota: 'Provider quota is insufficient.',
  server_error: 'Provider reported an internal error.'
};

function logDiagnostic(status, model, key, providerDetail, failure) {
  const allowed = value => typeof value === 'string' && value !== key &&
    Object.hasOwn(diagnosticMessages, value) ? value : null;
  const code = allowed(providerDetail?.code);
  const type = allowed(providerDetail?.type);
  const safeModel = typeof model === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9/_.:-]{0,119}$/.test(model) &&
    !model.includes(key) && !/(?:gsk_|sk-|bearer|secret|token)/i.test(model) ? model : '[redacted]';
  try {
    console.warn('[Wind Flower AI][Groq]', {
      httpStatus: status,
      model: safeModel,
      errorCode: code || 'unrecognized_or_unavailable',
      errorType: type || 'unrecognized_or_unavailable',
      message: diagnosticMessages[code] || diagnosticMessages[type] || errors[failure][1],
      failure
    });
  } catch { /* Diagnostics must never change request handling. */ }
}

async function complete(messages) {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw providerError('GROQ_NOT_CONFIGURED');
  const model = process.env.GROQ_MODEL?.trim();
  if (!model) throw providerError('GROQ_MODEL_MISSING');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let httpStatus = null;
  let providerDetail = null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controller.signal, redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, stream: false })
    });
    httpStatus = Number.isInteger(response.status) ? response.status : null;
    if (!response.ok) {
      try {
        const body = await response.json();
        providerDetail = body?.error;
      } catch { /* Non-JSON errors retain the existing HTTP error mapping. */ }
      throw providerError(response.status === 429 ? 'GROQ_RATE_LIMIT' : 'GROQ_PROVIDER_ERROR');
    }
    let data;
    try { data = await response.json(); } catch (error) {
      if (controller.signal.aborted) throw error;
      throw providerError('GROQ_INVALID_RESPONSE');
    }
    const choice = data?.choices?.[0];
    const reply = choice?.message?.content;
    if (typeof reply !== 'string' || !reply.trim() || choice.message.tool_calls?.length ||
        (choice.finish_reason && choice.finish_reason !== 'stop')) throw providerError('GROQ_INVALID_RESPONSE');
    return reply.trim();
  } catch (error) {
    const failure = controller.signal.aborted ? 'GROQ_TIMEOUT' :
      Object.hasOwn(errors, error.code) ? error.code : 'GROQ_NETWORK_ERROR';
    logDiagnostic(httpStatus, model, key, providerDetail, failure);
    if (controller.signal.aborted) throw providerError('GROQ_TIMEOUT');
    if (Object.hasOwn(errors, error.code)) throw error;
    throw providerError('GROQ_NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { complete };
