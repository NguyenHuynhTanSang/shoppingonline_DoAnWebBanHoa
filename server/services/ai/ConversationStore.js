const { randomBytes } = require('crypto');
const TTL = 30 * 60 * 1000;
function failure(code, status) { const error = new Error(code); error.code = code; error.status = status; return error; }
async function load(id, actor) {
  if (id !== undefined && (typeof id !== 'string' || !/^[a-f\d]{64}$/.test(id))) throw failure('INVALID_CONVERSATION', 400);
  if (actor && actor.role !== 'customer') throw failure('FORBIDDEN', 403);
  const owner = actor?.id || null;
  const { AIConversation, SupportRequest } = require('../../models/Models');
  try {
    let stored = id ? await AIConversation.findOne({ _id: id, owner, expiresAt: { $gt: new Date() } }).lean().maxTimeMS(3000).exec() : null;
    // Old AI context must never survive a subsequent human support session, including other tabs.
    if (stored && owner && await SupportRequest.exists({ customerId: owner, createdAt: { $gte: stored.createdAt } }).maxTimeMS(3000).exec()) stored = null;
    return stored || { _id: randomBytes(32).toString('hex'), owner, constraints: {}, productIds: [], selectedId: null, revision: 0, createdAt: new Date(), fresh: true };
  } catch { throw failure('CONVERSATION_UNAVAILABLE', 503); }
}
async function save(context) {
  const { AIConversation } = require('../../models/Models');
  const data = { constraints: context.constraints, productIds: context.productIds.slice(0, 4), selectedId: context.selectedId, lastOrderId: context.lastOrderId || null, lastPolicyTopic: context.lastPolicyTopic || null, expiresAt: new Date(Date.now() + TTL) };
  try {
    if (context.fresh) await AIConversation.create({ _id: context._id, owner: context.owner, createdAt: context.createdAt, ...data });
    else {
      const result = await AIConversation.updateOne({ _id: context._id, owner: context.owner, revision: context.revision, expiresAt: { $gt: new Date() } }, { $set: data, $inc: { revision: 1 } }, { runValidators: true }).maxTimeMS(3000).exec();
      if (!result.matchedCount) throw failure('CONVERSATION_CONFLICT', 409);
    }
  } catch (error) { throw failure(error.code === 'CONVERSATION_CONFLICT' ? error.code : 'CONVERSATION_UNAVAILABLE', error.code === 'CONVERSATION_CONFLICT' ? 409 : 503); }
  return context._id;
}
module.exports = { load, save, TTL };
