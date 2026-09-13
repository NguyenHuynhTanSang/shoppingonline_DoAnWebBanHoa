const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PasswordService = require('../services/PasswordService');

function setup() {
  const state = { writes: [], customer: { _id: 'id', username: 'user', name: 'Name', email: 'a@example.test', password: 'legacy', active: 1 } };
  const handlers = {};
  const save = async value => { state.writes.push({ ...value }); return value; };
  const sanitize = value => { const { password, token, ...safe } = value; return safe; };
  const context = {
    PasswordService, TypeError, RangeError,
    router: Object.fromEntries(['post', 'put'].map(method => [method, (url, ...args) => { handlers[url] = args.at(-1); }])),
    JwtUtil: { checkToken() {}, requireRoles: () => () => {} }, requireActiveCustomer() {},
    CustomerDAO: { selectByUsernameOrEmail: async () => null, insert: save, update: save },
    StaffDAO: { insert: save, selectByID: async () => state.customer, update: save },
    Models: { Staff: { findOne: () => ({ exec: async () => null }) } },
    genRandomToken: () => 'synthetic-token', genRandomPassword: () => 'generated-password',
    sanitizeCustomer: sanitize, safeAccount: sanitize,
    console: { error: (...args) => { assert.equal(args.length, 1); assert.equal(typeof args[0], 'string'); } }
  };
  for (const [file, start, end] of [
    ['customer', "router.post('/signup'", "router.post('/login'"],
    ['customer', "router.put('/profile'", "router.post('/checkout'"],
    ['admin', "router.post(\n  '/staff',", "router.put(\n  '/staffs/:id/status'"]
  ]) {
    const source = fs.readFileSync(path.join(__dirname, '../api', file + '.js'), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(source.indexOf(start) >= 0 && source.indexOf(end) > source.indexOf(start));
    vm.runInNewContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
  }
  state.request = async (url, body) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handlers[url]({ body, dbCustomer: state.customer, params: { id: 'id' } }, res);
    if (res.data.customer) assert.equal(Object.hasOwn(res.data.customer, 'password'), false);
    if (res.data.staff) assert.equal(Object.hasOwn(res.data.staff, 'password'), false);
    return res;
  };
  return state;
}

test('signup and supplied/generated staff passwords are bcrypt before persistence', async () => {
  for (const url of ['/signup', '/staff']) {
    const inputs = ['new-password', await PasswordService.hashPassword('hash-looking-input')];
    if (url === '/staff') inputs.push(undefined);
    for (const password of inputs) {
      const state = setup();
      const result = await state.request(url, { username: 'new', name: 'New', email: 'new@example.test', password });
      assert.equal(result.data.success, true);
      const stored = state.writes[0].password;
      assert.equal(PasswordService.isBcryptHash(stored), true);
      assert.notEqual(stored, password);
      assert.equal(await PasswordService.verifyLoginPassword(password ?? 'generated-password', stored), true);
      assert.equal(JSON.stringify(result.data).includes(stored), false);
    }
  }
});

test('profile/staff edits retain unchanged credentials exactly and hash only new input', async () => {
  for (const url of ['/profile', '/staffs/:id']) {
    for (const stored of ['legacy', await PasswordService.hashPassword('old-password')]) {
      for (const password of [undefined, '', '   ']) {
        const state = setup(); state.customer.password = stored;
        assert.equal((await state.request(url, { password })).data.success, true);
        assert.equal(state.writes[0].password, stored);
      }
      const state = setup(); state.customer.password = stored;
      assert.equal((await state.request(url, { password: 'new-password' })).data.success, true);
      assert.equal(await PasswordService.verifyLoginPassword('new-password', state.writes[0].password), true);
      assert.equal(await PasswordService.verifyLoginPassword('old-password', state.writes[0].password), false);
    }
  }
});

test('all write routes reject short, non-string and over-72-byte new passwords before persistence', async () => {
  for (const url of ['/signup', '/staff', '/profile', '/staffs/:id']) {
    for (const password of ['short', {}, 123456, '🌸'.repeat(19)]) {
      const state = setup();
      const result = await state.request(url, { username: 'new', name: 'New', email: 'new@example.test', password });
      assert.equal(result.code, 400);
      assert.equal(result.data.success, false);
      assert.equal(state.writes.length, 0);
    }
  }
});
