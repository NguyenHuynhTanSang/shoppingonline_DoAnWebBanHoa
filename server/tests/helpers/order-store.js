// Deterministic snapshot/optimistic-commit simulation, NOT a MongoDB integration test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function load(file, dependencies) {
  const module = { exports: {} };
  new Function('require', 'module', fs.readFileSync(path.join(__dirname, '../..', file), 'utf8'))(name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
  }, module);
  return module.exports;
}
function setup() {
  const state = { products: {}, orders: {}, vouchers: {} };
  const faults = {};
  const writes = [];
  let version = 0, retries = 0, ended = 0;
  const mongo = { Types: mongoose.Types, async startSession() {
    const session = { active: false, inTransaction() { return this.active; }, async endSession() { ended++; },
      async withTransaction(work) {
        if (faults.unsupported) throw new Error('synthetic transaction unsupported');
        for (let attempt = 0; attempt < 12; attempt++) {
          const before = version;
          session.data = clone(state); session.active = true; session.dirty = false;
          try { await work(); } catch (error) { session.active = false; throw error; }
          if (faults.beforeCommit) await faults.beforeCommit(session);
          session.active = false;
          if (session.dirty) {
            for (const row of Object.values(session.data.orders)) {
              if (!row.checkoutIdempotencyKey || state.orders[row._id]) continue;
              if (Object.values(state.orders).some(old => old.customer._id === row.customer._id && old.checkoutIdempotencyKey === row.checkoutIdempotencyKey)) {
                throw Object.assign(new Error('synthetic unique conflict'), { code: 11000 });
              }
            }
          }
          if (before !== version || faults.retryOnce) { faults.retryOnce = false; retries++; continue; }
          if (faults.commit) throw new Error('synthetic commit failure before persistence');
          if (session.dirty) { Object.assign(state, session.data); version++; }
          if (faults.commitResponseLost) {
            faults.commitResponseLost = false;
            throw new Error('synthetic unknown commit result after persistence');
          }
          return;
        }
        throw new Error('test retry budget exhausted');
      }
    };
    return session;
  } };
  const data = session => { assert.ok(session?.inTransaction(), 'all lifecycle DB operations require the active session'); return session.data; };
  function query(run, session) {
    return { select() { return this; }, session(value) { session = value; return this; }, async exec() { return clone(await run(session)); } };
  }
  function matches(row, filter) {
    return row && Object.entries(filter).every(([key, expected]) => {
      if (key === '$or') return expected.some(part => matches(row, part));
      const actual = key.split('.').reduce((value, field) => value?.[field], row);
      if (expected && typeof expected === 'object' && ('$eq' in expected || '$lt' in expected || '$exists' in expected)) {
        return (!('$eq' in expected) || actual === expected.$eq) &&
          (!('$lt' in expected) || actual < expected.$lt) &&
          (!('$exists' in expected) || (actual !== undefined) === expected.$exists);
      }
      if (expected && typeof expected === 'object' && '$gte' in expected) return actual >= expected.$gte;
      if (expected && typeof expected === 'object' && '$gt' in expected) return actual > expected.$gt;
      return String(actual) === String(expected);
    });
  }
  function model(collection) {
    return {
      findById(id) { return query(session => data(session)[collection][String(id)] || null); },
      findOne(filter) { return query(session => Object.values((session ? data(session) : state)[collection]).find(row => matches(row, filter)) || null); },
      findByIdAndUpdate(id, update, options) { return this.findOneAndUpdate({ _id: id }, update, options); },
      findOneAndUpdate(filter, update, { session } = {}) {
        return query(current => {
          const rows = data(current)[collection];
          writes.push({ collection, filter: clone(filter), update: clone(update) });
          if (faults[collection]) throw new Error('synthetic write failure');
          if (collection === 'products' && faults.soldId === String(filter._id) && update.$inc?.sold) throw new Error('synthetic sold failure');
          if (collection === 'orders' && faults.stale) return null;
          if (collection === 'vouchers' && faults.voucherMiss) return null;
          const row = Object.values(rows).find(value => matches(value, filter));
          if (!row) return null;
          current.dirty = true;
          Object.assign(row, update.$set);
          for (const [key, amount] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + amount;
          return row;
        }, session);
      },
      async create(rows, { session }) {
        const table = data(session)[collection];
        if (faults.create) throw new Error('synthetic insert failure');
        session.dirty = true;
        for (const row of rows) table[String(row._id)] = clone(row);
        return clone(rows);
      }
    };
  }
  const models = { Product: model('products'), Order: model('orders'), Voucher: model('vouchers') };
  models.Order.collection = { listIndexes() { return { async toArray() {
    if (faults.indexError) throw new Error('index unavailable');
    return faults.indexes || [{ name: 'checkout_customer_key_unique', key: { 'customer._id': 1, checkoutIdempotencyKey: 1 }, unique: true,
      partialFilterExpression: { checkoutIdempotencyKey: { $type: 'string' } } }];
  } }; } };
  const dependencies = { mongoose: mongo, '../utils/MongooseUtil': {}, './Models': models };
  const productDAO = load('models/ProductDAO.js', dependencies);
  const orderDAO = load('models/OrderDAO.js', dependencies);
  const lifecycle = load('services/OrderLifecycleService.js', {
    mongoose: mongo, '../models/OrderDAO': orderDAO, '../models/ProductDAO': productDAO, '../models/Models': models,
    '../utils/PaymentPolicy': require('../../utils/PaymentPolicy'),
    '../utils/OrderStateMachine': require('../../utils/OrderStateMachine')
  });
  return { state, faults, writes, mongo, models, lifecycle, productDAO, orderDAO, stats: () => ({ retries, ended }) };
}
async function http(store) {
  const express = require('express');
  const pass = (req, res, next) => next();
  const idempotency = load('services/CheckoutIdempotencyService.js', { crypto: require('crypto'), '../models/OrderDAO': store.orderDAO, './OrderLifecycleService': store.lifecycle, '../utils/DeliveryValidation': require('../../utils/DeliveryValidation'), '../utils/PaymentPolicy': require('../../utils/PaymentPolicy') });
  const dependencies = {
    '../services/CheckoutIdempotencyService': idempotency,
    express, mongoose: store.mongo, crypto: require('crypto'), './support': express.Router(),
    '../services/OrderLifecycleService': store.lifecycle,
    '../utils/PaymentPolicy': require('../../utils/PaymentPolicy'),
    '../utils/OrderStateMachine': require('../../utils/OrderStateMachine'),
    '../services/PasswordService': {}, '../utils/EmailUtil': {}, '../utils/MyConstants': {},
    '../utils/AuthRateLimit': { login: pass, forgot: pass, reset: pass },
    '../utils/DeliveryValidation': require('../../utils/DeliveryValidation'), '../utils/ShippingRules': require('../../utils/ShippingRules'),
    '../models/AdminDAO': {}, '../models/StaffDAO': {}, '../models/CategoryDAO': {},
    '../models/OrderDAO': store.orderDAO, '../models/ProductDAO': store.productDAO, '../models/Models': store.models,
    '../models/CustomerDAO': { async selectByID(id) { return { _id: id, name: 'Customer', active: 1 }; } },
    '../utils/JwtUtil': {
      checkToken(req, res, next) {
        if (!req.headers['x-role']) return res.sendStatus(401);
        req.decoded = { role: req.headers['x-role'], sub: req.headers['x-owner'] || '4'.repeat(24) }; next();
      },
      requireRoles: roles => (req, res, next) => roles.includes(req.decoded.role) ? next() : res.sendStatus(403)
    }
  };
  const app = express(); app.use(express.json());
  for (const name of ['admin', 'customer']) app.use('/api/' + name, load('api/' + name + '.js', dependencies));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return {
    async request(url, method, body, role = 'customer', owner = '4'.repeat(24), key = require('crypto').randomUUID()) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${url}`, {
        method, headers: { 'Content-Type': 'application/json', 'x-role': role, 'x-owner': owner, ...(key === null ? {} : { 'Idempotency-Key': key }) }, body: JSON.stringify(body)
      });
      const text = await response.text();
      return { status: response.status, body: text.startsWith('{') ? JSON.parse(text) : text };
    },
    close: () => new Promise(resolve => server.close(resolve))
  };
}
module.exports = { setup, load, http };
