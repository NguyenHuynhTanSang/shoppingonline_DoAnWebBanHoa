const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const PasswordService = require('../services/PasswordService');
const AuthRateLimit = require('../utils/AuthRateLimit');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n');
const ids = { Admin: '1'.repeat(24), Staff: '2'.repeat(24), Customer: '3'.repeat(24) };

function setup(options = {}) {
  const accounts = Object.fromEntries(Object.entries(ids).map(([role, _id]) => [role, { _id, username: role.toLowerCase(), email: role.toLowerCase() + '@example.test', name: role, active: 1, password: 'oldpass' }]));
  const writes = [];
  let failWrite = false;
  const clone = value => value ? { ...value } : null;
  const query = run => ({ select() { return this; }, lean() { return this; }, async exec() { return clone(run()); } });
  function match(account, filter) {
    if (!account) return false;
    return Object.entries(filter).every(([key, value]) => {
      if (key === '$or') return value.some(part => match(account, part));
      if (value && typeof value === 'object') {
        if ('$gt' in value) return account[key] > value.$gt;
        if ('$nin' in value) return !value.$nin.includes(account[key]);
        if ('$ne' in value) return account[key] !== value.$ne;
      }
      return account[key] === value;
    });
  }
  function apply(role, filter, update) {
    if (options.beforeWrite) options.beforeWrite({ role, filter, update, accounts });
    if (failWrite) return null;
    const account = accounts[role];
    if (!match(account, filter)) return null;
    writes.push({ role, update });
    Object.assign(account, update.$set || update);
    for (const [key, increment] of Object.entries(update.$inc || {})) account[key] = (account[key] || 0) + increment;
    return account;
  }
  const Models = Object.fromEntries(Object.keys(ids).map(role => [role, {
    findOne: filter => query(() => match(accounts[role], filter) ? accounts[role] : null),
    findById: id => query(() => accounts[role]?._id === id ? accounts[role] : null),
    findOneAndUpdate: (filter, update) => query(() => apply(role, filter, update)),
    findByIdAndUpdate: (id, update) => query(() => apply(role, { _id: id }, update))
  }]));
  function load(file, dependencies) {
    const module = { exports: {} };
    vm.runInNewContext(read(file), { module, Buffer, TypeError, RangeError, require(name) {
      if (!(name in dependencies)) throw Error('Unexpected dependency: ' + name);
      return dependencies[name];
    } });
    return module.exports;
  }
  const JwtUtil = load('utils/JwtUtil.js', { jsonwebtoken: jwt, './MyConstants': { JWT_SECRET: 'synthetic-session-secret', JWT_EXPIRES: '1h' }, '../models/Models': Models });
  const daos = Object.fromEntries(Object.keys(ids).map(role => [role + 'DAO', load(`models/${role}DAO.js`, { '../utils/MongooseUtil': {}, mongoose: {}, './Models': Models })]));
  const handlers = {}, middlewares = {};
  const sanitize = account => { const { password, tokenVersion, resetPasswordToken, resetPasswordExpire, ...safe } = account; return safe; };
  const context = { ...daos, Models, JwtUtil, PasswordService, AuthRateLimit, TypeError, RangeError,
    requireActiveCustomer() {}, sanitizeCustomer: sanitize, safeAccount: sanitize,
    console: { error() { /* no raw provider/credential diagnostics */ } },
    router: Object.fromEntries(['post', 'put'].map(method => [method, (url, ...args) => { handlers[url] = args.at(-1); middlewares[url] = args.slice(0, -1); }]))
  };
  for (const [file, start, end] of [
    ['admin', "router.post('/login'", '\n// ========================='],
    ['admin', "router.put(\n  '/staffs/:id',", "router.put(\n  '/staffs/:id/status'"],
    ['customer', "router.post('/reset-password'", "router.put('/profile'"],
    ['customer', "router.put('/profile'", "router.post('/checkout'"],
    ['customer', "router.post('/login'", '\nrouter.get(']
  ]) {
    const source = read(`api/${file}.js`), a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a);
    vm.runInNewContext(source.slice(a, b), context);
    if (start === "router.post('/login'") {
      handlers[file + '-login'] = handlers['/login'];
      assert.equal(middlewares['/login'][0], AuthRateLimit.login);
    }
  }
  assert.equal(middlewares['/reset-password'][0], AuthRateLimit.reset);
  async function request(url, body, role = 'Customer') {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handlers[url]({ body, dbCustomer: clone(accounts[role]), params: { id: ids[role] } }, res);
    return res;
  }
  const support = load('services/SupportChatService.js', {
    mongoose: {}, '../models/Models': Models, '../utils/JwtUtil': JwtUtil,
    './ai/HandoffService': { safeMessage() {} }
  });
  return { accounts, writes, JwtUtil, daos, request, support, fail(value) { failWrite = value; } };
}

test('legacy migration preserves version-zero sessions; role-specific JWT checks reject invalid account/version/status', async () => {
  const app = setup();
  for (const role of Object.keys(ids)) {
    const oldToken = app.JwtUtil.genToken({ sub: ids[role], role: role.toLowerCase() });
    await app.JwtUtil.verifySession(oldToken);
    await app.support.authenticate(oldToken);
    const login = await app.request(role === 'Customer' ? 'customer-login' : 'admin-login', { username: role.toLowerCase(), password: 'oldpass' });
    assert.equal(login.body.success, true);
    assert.equal(app.accounts[role].tokenVersion, undefined);
    await app.JwtUtil.verifySession(oldToken);
    await app.JwtUtil.verifySession(login.body.token);
    const before = app.writes.length;
    await app.request(role === 'Customer' ? 'customer-login' : 'admin-login', { username: role.toLowerCase(), password: 'oldpass' });
    assert.equal(app.writes.length, before);
    app.accounts[role].tokenVersion = 1;
    await assert.rejects(app.JwtUtil.verifySession(oldToken));
    await assert.rejects(app.support.authenticate(oldToken));
    const newToken = app.JwtUtil.genToken({ sub: ids[role], role: role.toLowerCase(), tokenVersion: 1 });
    await app.JwtUtil.verifySession(newToken);
    await app.support.authenticate(newToken);
  }
  await assert.rejects(app.JwtUtil.verifySession(app.JwtUtil.genToken({ sub: ids.Staff, role: 'admin' })));
  app.accounts.Staff.active = 0;
  await assert.rejects(app.JwtUtil.verifySession(app.JwtUtil.genToken({ sub: ids.Staff, role: 'staff', tokenVersion: 1 })));
});

test('profile and staff password edits increment atomically; blank/missing/same password do not revoke', async () => {
  for (const role of ['Customer', 'Staff']) {
    const app = setup(), url = role === 'Customer' ? '/profile' : '/staffs/:id';
    const loginUrl = role === 'Customer' ? 'customer-login' : 'admin-login';
    const login = await app.request(loginUrl, { username: role.toLowerCase(), password: 'oldpass' });
    const oldToken = login.body.token;
    const before = app.accounts[role].password;
    for (const password of [undefined, '', '   ', 'oldpass']) {
      assert.equal((await app.request(url, { password }, role)).body.success, true);
      assert.equal(app.accounts[role].password, before);
      assert.equal(app.accounts[role].tokenVersion, undefined);
      await app.JwtUtil.verifySession(oldToken);
    }
    assert.equal((await app.request(url, { password: 'newpass' }, role)).body.success, true);
    assert.equal(app.accounts[role].tokenVersion, 1);
    assert.equal(app.writes.at(-1).update.$inc.tokenVersion, 1);
    await assert.rejects(app.JwtUtil.verifySession(oldToken));
    assert.equal((await app.request(loginUrl, { username: role.toLowerCase(), password: 'oldpass' })).body.success, false);
    const next = await app.request(loginUrl, { username: role.toLowerCase(), password: 'newpass' });
    await app.JwtUtil.verifySession(next.body.token);
    const current = app.accounts[role].password;
    assert.equal((await app.request(url, { password: 'short' }, role)).statusCode, 400);
    app.fail(true);
    assert.equal((await app.request(url, { password: 'thirdpass' }, role)).body.success, false);
    assert.equal(app.accounts[role].tokenVersion, 1); assert.equal(app.accounts[role].password, current);
  }
});

test('reset changes password, consumes token and increments version in one update; old JWT fails', async () => {
  const app = setup();
  const login = await app.request('customer-login', { username: 'customer', password: 'oldpass' });
  Object.assign(app.accounts.Customer, { resetPasswordToken: 'synthetic-reset', resetPasswordExpire: Date.now() + 60000 });
  const reset = await app.request('/reset-password', { token: 'synthetic-reset', password: 'newpass' });
  assert.equal(reset.body.success, true);
  assert.equal(app.accounts.Customer.resetPasswordToken, '');
  assert.equal(app.accounts.Customer.tokenVersion, 1);
  await assert.rejects(app.JwtUtil.verifySession(login.body.token));
  const next = await app.request('customer-login', { email: 'customer@example.test', password: 'newpass' });
  await app.JwtUtil.verifySession(next.body.token);
  assert.equal((await app.request('/reset-password', { token: 'synthetic-reset', password: 'thirdpass' })).body.success, false);
  assert.equal(app.accounts.Customer.tokenVersion, 1);
  // Exercise the actual HTTP auth middleware on old/new JWTs.
  for (const [token, accepted] of [[login.body.token, false], [next.body.token, true]]) {
    let called = false;
    const res = { status(code) { this.code = code; return this; }, json() { return this; } };
    await app.JwtUtil.checkToken({ headers: { authorization: 'Bearer ' + token } }, res, () => { called = true; });
    assert.equal(called, accepted);
    if (!accepted) assert.equal(res.code, 401);
  }
});

test('explicit same-password legacy reset persists bcrypt and revokes old sessions', async () => {
  const app = setup();
  const token = app.JwtUtil.genToken({ sub: ids.Customer, role: 'customer' });
  Object.assign(app.accounts.Customer, { resetPasswordToken: 'synthetic-reset', resetPasswordExpire: Date.now() + 60000 });
  assert.equal((await app.request('/reset-password', { token: 'synthetic-reset', password: 'oldpass' })).body.success, true);
  assert.equal(PasswordService.isBcryptHash(app.accounts.Customer.password), true);
  assert.equal(await PasswordService.verifyPassword('oldpass', app.accounts.Customer.password), true);
  assert.equal(app.accounts.Customer.tokenVersion, 1);
  assert.equal(app.accounts.Customer.resetPasswordToken, '');
  await assert.rejects(app.JwtUtil.verifySession(token));
});

test('same-password reset racing a credential change atomically revokes the intervening JWT', async () => {
  const replacement = await PasswordService.hashPassword('newpass');
  let intermediateToken;
  const app = setup({ beforeWrite({ filter, accounts }) {
    if (filter.resetPasswordToken) {
      accounts.Customer.password = replacement;
      accounts.Customer.tokenVersion = 1;
      intermediateToken = app.JwtUtil.genToken({ sub: ids.Customer, role: 'customer', tokenVersion: 1 });
    }
  } });
  Object.assign(app.accounts.Customer, { resetPasswordToken: 'synthetic-reset', resetPasswordExpire: Date.now() + 60000 });
  const result = await app.request('/reset-password', { token: 'synthetic-reset', password: 'oldpass' });
  assert.equal(result.body.success, true);
  assert.equal(app.accounts.Customer.tokenVersion, 2);
  assert.equal(await PasswordService.verifyPassword('oldpass', app.accounts.Customer.password), true);
  assert.equal(await PasswordService.verifyPassword('newpass', app.accounts.Customer.password), false);
  assert.equal(app.accounts.Customer.resetPasswordToken, '');
  assert.equal(app.accounts.Customer.resetPasswordExpire, 0);
  await assert.rejects(app.JwtUtil.verifySession(intermediateToken));
});
