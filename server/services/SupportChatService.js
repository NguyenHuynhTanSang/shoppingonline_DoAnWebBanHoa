const mongoose = require('mongoose');
const Models = require('../models/Models');
const JwtUtil = require('../utils/JwtUtil');
const { safeMessage } = require('./ai/HandoffService');
const isId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
function deny(code = 'FORBIDDEN', status = 403) { const error = new Error(code); error.code = code; error.status = status; return error; }
async function authenticate(token) {
  let decoded;
  try { decoded = JwtUtil.verifyToken(token); } catch { throw deny('AUTH_REQUIRED', 401); }
  const model = { customer: Models.Customer, staff: Models.Staff, admin: Models.Admin }[decoded.role];
  if (!model || !isId(decoded.sub)) throw deny();
  const account = await model.findById(decoded.sub).select('_id active tokenVersion').lean().exec();
  if (!JwtUtil.isCurrentSession(decoded, account)) throw deny('AUTH_REQUIRED', 401);
  if (!account || (decoded.role !== 'admin' && Number(account.active) !== 1)) throw deny();
  return { id: decoded.sub, role: decoded.role };
}
function permitted(request, actor) {
  return actor.role === 'customer' ? String(request.customerId) === actor.id :
    actor.role === 'admin' || (actor.role === 'staff' && request.assignedTo?.role === 'staff' && String(request.assignedTo?.id) === actor.id);
}
function view(request) { return { id: String(request._id), status: request.status }; }
async function authorize(actor, id) {
  if (!isId(id)) throw deny('INVALID_REQUEST', 400);
  const request = await Models.SupportRequest.findById(id).select('_id customerId assignedTo status').lean().exec();
  if (!request || !permitted(request, actor)) throw deny();
  return request;
}
async function current(actor) {
  if (actor.role !== 'customer') throw deny();
  const inProgress = await active(actor);
  if (inProgress) return inProgress;
  const request = await Models.SupportRequest.findOne({ customerId: actor.id }).sort({ createdAt: -1, _id: -1 }).select('_id status').lean().exec();
  return request ? view(request) : null;
}
async function active(actor) {
  if (actor.role !== 'customer') return null;
  const request = await Models.SupportRequest.findOne({ customerId: actor.id, status: 'in_progress' }).select('_id status').lean().exec();
  return request ? view(request) : null;
}
async function history(actor, id, before) {
  const request = await authorize(actor, id);
  if (before !== undefined && (!/^\d{1,12}$/.test(String(before)) || Number(before) < 1)) throw deny('INVALID_REQUEST', 400);
  const query = { supportRequestId: id };
  if (before !== undefined) query.sequence = { $lt: Number(before) };
  const rows = await Models.SupportMessage.find(query).select('_id senderType message sequence createdAt clientMessageId').sort({ sequence: -1 }).limit(50).lean().exec();
  return { request: view(request), messages: rows.reverse(), hasMore: rows.length === 50 };
}
async function send(actor, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).some(key => !['supportRequestId', 'message', 'clientMessageId'].includes(key)) ||
      !isId(payload.supportRequestId) || typeof payload.message !== 'string' || !payload.message.trim() || payload.message.length > 2000 ||
      typeof payload.clientMessageId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(payload.clientMessageId)) throw deny('INVALID_MESSAGE', 400);
  const request = await authorize(actor, payload.supportRequestId);
  if (request.status !== 'in_progress') throw deny('SESSION_CLOSED', 409);
  // Transactions touch the same request as resolve: concurrent writes cannot admit a post-resolve message.
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const filter = { _id: payload.supportRequestId, status: 'in_progress' };
      if (actor.role === 'customer') filter.customerId = actor.id;
      if (actor.role === 'staff') { filter['assignedTo.id'] = actor.id; filter['assignedTo.role'] = 'staff'; }
      const locked = await Models.SupportRequest.findOneAndUpdate(filter, { $inc: { chatSequence: 1 } }, { new: true, session }).lean().exec();
      if (!locked) throw deny('SESSION_CLOSED', 409);
      const identity = { supportRequestId: payload.supportRequestId, senderId: actor.id, senderType: actor.role, clientMessageId: payload.clientMessageId };
      const existing = await Models.SupportMessage.findOne(identity).session(session).lean().exec();
      if (existing) { result = existing; return; }
      const [created] = await Models.SupportMessage.create([{ ...identity, message: safeMessage(payload.message.trim()), sequence: locked.chatSequence }], { session });
      result = created.toObject();
    });
  } finally { await session.endSession(); }
  return { _id: String(result._id), senderType: result.senderType, message: result.message, sequence: result.sequence, createdAt: result.createdAt, clientMessageId: result.clientMessageId };
}
module.exports = { authenticate, authorize, current, active, history, send, view };
