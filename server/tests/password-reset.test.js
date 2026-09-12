const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const marker = 'SYNTHETIC_RESET_TOKEN';
const link = 'https://shop.example/reset-password?token=' + marker;

function setup(mail = async () => true) {
  const state = { customer: { _id: 'customer', email: 'test@example.test', password: 'old', resetPasswordToken: marker, resetPasswordExpire: Date.now() + 60000 }, logs: [], noMatch: false };
  const query = value => ({ exec: async () => value });
  const matches = filter => state.customer && state.customer.resetPasswordToken === filter.resetPasswordToken && state.customer.resetPasswordExpire > filter.resetPasswordExpire.$gt;
  const models = { Customer: {
    findOne: filter => query(filter.email ? state.customer : matches(filter) ? state.customer : null),
    findByIdAndUpdate: (id, values) => query(Object.assign(state.customer, values)),
    findOneAndUpdate: (filter, values) => {
      if (state.updateError) throw Error(link);
      return query(!state.noMatch && matches(filter) ? Object.assign(state.customer, values) : null);
    }
  } };
  const module = { exports: {} };
  vm.runInNewContext(read('../models/CustomerDAO.js'), { module, require: name => {
    if (name === './Models') return models;
    if (name === 'mongoose' || name === '../utils/MongooseUtil') return {};
    throw Error('Unexpected dependency');
  }, Date });
  const routes = {};
  const source = read('../api/customer.js');
  vm.runInNewContext(source.slice(source.indexOf("router.post('/forgot-password'"), source.indexOf("router.put('/profile'")), {
    router: { post: (url, handler) => { routes[url] = handler; } },
    CustomerDAO: module.exports, EmailUtil: { sendResetPasswordEmail: mail },
    MyConstants: { CLIENT_URL: 'https://shop.example' }, genRandomToken: () => marker,
    Date, Promise, setTimeout: callback => setTimeout(callback, 5), clearTimeout,
    console: { log: (...args) => state.logs.push(args), error: (...args) => state.logs.push(args) }
  });
  state.request = async (url, body) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await routes[url]({ body }, res);
    assert.equal(JSON.stringify([res.data, state.logs]).includes(marker), false);
    assert.equal(JSON.stringify([res.data, state.logs]).includes(link), false);
    return res;
  };
  return state;
}

test('forgot responses are identical for known/unknown email, delivery failure, rejection and timeout', async () => {
  let expected;
  for (const mail of [async () => true, async () => false, async () => { throw Error(link); }, () => new Promise(() => {})]) {
    for (const known of [true, false]) {
      const state = setup(mail);
      if (!known) state.customer = null;
      const res = await state.request('/forgot-password', { email: 'test@example.test' });
      assert.equal(res.code, 200);
      const data = JSON.stringify(res.data);
      expected ??= data;
      assert.equal(data, expected);
      assert.deepEqual(Object.keys(res.data).sort(), ['message', 'success']);
    }
  }
});

test('reset validates types, minimum length, token and expiry', async () => {
  for (const body of [{}, { token: {}, password: 'abcdef' }, { token: marker, password: 123456 }, { token: marker, password: '     ' }, { token: marker, password: '12345' }, { token: 'invalid', password: 'abcdef' }]) {
    const state = setup();
    const res = await state.request('/reset-password', body);
    assert.equal(res.code, 400); assert.equal(res.data.success, false);
    assert.equal(state.customer.password, 'old');
  }
  const state = setup(); state.customer.resetPasswordExpire = Date.now() - 1;
  assert.equal((await state.request('/reset-password', { token: marker, password: 'abcdef' })).code, 400);
});

test('atomic DAO update clears token; reuse and lost update cannot succeed', async () => {
  const state = setup();
  const body = { token: marker, password: 'abcdef' };
  assert.equal((await state.request('/reset-password', body)).data.success, true);
  assert.equal(state.customer.password, 'abcdef');
  assert.equal(state.customer.resetPasswordToken, '');
  assert.equal(state.customer.resetPasswordExpire, 0);
  assert.equal((await state.request('/reset-password', body)).code, 400);
  const race = setup(); race.noMatch = true;
  assert.equal((await race.request('/reset-password', body)).data.success, false);
  assert.equal(race.customer.password, 'old');
  const concurrent = setup();
  const results = await Promise.all([concurrent.request('/reset-password', body), concurrent.request('/reset-password', body)]);
  assert.equal(results.filter(res => res.data.success).length, 1);
  const failure = setup(); failure.updateError = true;
  const failed = await failure.request('/reset-password', body);
  assert.equal(failed.code, 500);
  assert.equal(failed.data.success, false);
  assert.equal(failure.customer.password, 'old');
});

test('reset email utility never logs provider error contents or link', async () => {
  for (const sendMail of [async () => { throw Error(link); }, () => new Promise(() => {}), async () => ({ messageId: link })]) {
    const logs = [];
    const module = { exports: {} };
    vm.runInNewContext(read('../utils/EmailUtil.js'), { module, require: name => {
      if (name === 'nodemailer') return { createTransport: () => ({ sendMail }) };
      if (name === './MyConstants') return { EMAIL_USER: 'test@example.test', EMAIL_PASS: 'synthetic' };
      throw Error('Unexpected dependency');
    }, setTimeout: callback => setTimeout(callback, 5), clearTimeout,
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) } });
    await module.exports.sendResetPasswordEmail('test@example.test', 'Test', link);
    assert.equal(JSON.stringify(logs).includes(marker), false);
  }
});
