const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PasswordService = require('../services/PasswordService');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const loginPaths = [
  { role: 'Admin', api: 'admin', identity: { username: 'user' } },
  { role: 'Staff', api: 'admin', identity: { username: 'user' } },
  { role: 'Customer', api: 'customer', identity: { username: 'user' } },
  { role: 'Customer', api: 'customer', identity: { email: 'user@example.test' } }
];
const accountFixture = role => ({ _id: role, username: 'user', email: 'user@example.test', active: 1, password: 'oldpass' });

test('two simultaneous legacy logins: one CAS wins, loser rereads and verifies before JWT', async () => {
  for (const { role, api, identity } of loginPaths) {
    const accounts = { [role]: accountFixture(role) };
    let arrived = 0, release;
    const barrier = new Promise(resolve => { release = resolve; });
    const app = setup(accounts, false, { beforeCas: async () => {
      assert.equal(app.tokens.length, 0);
      if (++arrived === 2) release();
      await barrier;
    } });
    const body = { ...identity, password: 'oldpass' };
    const results = await Promise.all([app.login(api, body), app.login(api, body)]);
    assert.equal(results.every(result => result.success), true);
    assert.equal(app.cas.length, 2);
    assert.equal(app.wins.length, 1);
    assert.equal(app.reads.length, 1);
    assert.equal(app.tokens.length, 2);
    assert.equal(await PasswordService.verifyPassword('oldpass', accounts[role].password), true);
  }
});

test('reset/profile/staff edit racing login: CAS miss never overwrites or issues JWT for old password', async () => {
  const replacement = await PasswordService.hashPassword('newpass');
  for (const { role, api, identity } of loginPaths) {
    for (const current of [replacement, '$2b$broken', '$2b$31$' + '.'.repeat(53)]) {
      const accounts = { [role]: accountFixture(role) };
      const app = setup(accounts, false, { beforeCas: () => {
        assert.equal(app.tokens.length, 0);
        accounts[role].password = current;
      } });
      assert.equal((await app.login(api, { ...identity, password: 'oldpass' })).success, false);
      assert.equal(accounts[role].password, current);
      assert.equal(app.wins.length, 0);
      assert.equal(app.reads.length, 1);
      assert.equal(app.tokens.length, 0);
    }
  }
});

test('status denial before/during migration and deleted account cannot receive JWT', async () => {
  for (const role of ['Staff', 'Customer']) {
    for (const active of [0, -1]) {
      const accounts = { [role]: { ...accountFixture(role), active } };
      const api = role === 'Staff' ? 'admin' : 'customer';
      const app = setup(accounts);
      assert.equal((await app.login(api, { username: 'user', password: 'oldpass' })).success, false);
      assert.equal(app.cas.length, 0);
      accounts[role].active = 1;
      const race = setup(accounts, false, { beforeCas: () => { accounts[role].active = active; } });
      assert.equal((await race.login(api, { username: 'user', password: 'oldpass' })).success, false);
      assert.equal(race.wins.length, 0); assert.equal(race.tokens.length, 0);
    }
  }
  const accounts = { Admin: accountFixture('Admin') };
  const app = setup(accounts, false, { beforeCas: () => { delete accounts.Admin; } });
  assert.equal((await app.login('admin', { username: 'user', password: 'oldpass' })).success, false);
  assert.equal(app.tokens.length, 0);
});

test('unhashable legacy passwords retain compatibility with no hash or CAS', async (t) => {
  const hash = t.mock.method(PasswordService, 'hashPassword', async () => { throw Error('must not hash'); });
  try {
    for (const { role, api, identity } of loginPaths) {
      for (const password of ['short', '🌸'.repeat(19)]) {
        const account = { ...accountFixture(role), password };
        const app = setup({ [role]: account });
        assert.equal((await app.login(api, { ...identity, password })).success, true);
        assert.equal(account.password, password); assert.equal(app.cas.length, 0);
      }
    }
    assert.equal(hash.mock.callCount(), 0);
  } finally { hash.mock.restore(); }
});

test('hash, CAS and reread failures fail closed with generic error and no JWT', async (t) => {
  for (const failure of ['hash', 'cas', 'read']) {
    const accounts = { Admin: accountFixture('Admin') };
    const marker = 'SYNTHETIC_PRIVATE_ERROR';
    const app = setup(accounts, false, {
      allowError: true, readError: failure === 'read',
      beforeCas: () => {
        if (failure === 'cas') throw Error(marker);
        if (failure === 'read') accounts.Admin.password = 'changed';
      }
    });
    const hash = failure === 'hash' ? t.mock.method(PasswordService, 'hashPassword', async () => { throw Error(marker); }) : null;
    try {
      const result = await app.login('admin', { username: 'user', password: 'oldpass' });
      assert.equal(result.success, false); assert.equal(app.tokens.length, 0); assert.equal(app.wins.length, 0);
      assert.equal(JSON.stringify([result, app.logs]).includes(marker), false);
      assert.equal(JSON.stringify(app.logs).includes('oldpass'), false);
    } finally { if (hash) hash.mock.restore(); }
  }
});

function setup(accounts, fallback = false, options = {}) {
  const queries = [], tokens = [], logs = [], cas = [], wins = [], reads = [];
  const copy = value => value ? { ...value } : null;
  const Models = {};
  for (const role of ['Admin', 'Staff', 'Customer']) {
    Models[role] = { findOne(filter) {
      assert.equal(Object.hasOwn(filter, 'password'), false);
      queries.push({ role, filter });
      const account = accounts[role];
      return { exec: async () => account && Object.entries(filter).every(([key, value]) => account[key] === value) ? copy(account) : null };
    }, findById(id) {
      return { exec: async () => {
        reads.push({ role, id });
        if (options.readError) throw Error('synthetic read error');
        return accounts[role]?._id === id ? copy(accounts[role]) : null;
      } };
    }, findOneAndUpdate(filter, update, config) {
      return { exec: async () => {
        cas.push({ role, filter, update });
        assert.equal(config.new, true);
        assert.deepEqual(Object.keys(update), ['$set']);
        assert.deepEqual(Object.keys(update.$set), ['password']);
        assert.equal(PasswordService.isBcryptHash(update.$set.password), true);
        if (options.beforeCas) await options.beforeCas({ role, accounts, filter });
        const account = accounts[role];
        if (!account || account._id !== filter._id || account.password !== filter.password) return null;
        if (role === 'Staff') {
          assert.equal(filter.active, 1);
          if (account.active !== 1) return null;
        }
        if (role === 'Customer') {
          assert.equal(JSON.stringify(filter.active), JSON.stringify({ $nin: [0, -1] }));
          if ([0, -1].includes(account.active)) return null;
        }
        account.password = update.$set.password;
        wins.push(role);
        return copy(account);
      } };
    } };
  }
  const daos = {};
  for (const role of ['Admin', 'Staff', 'Customer']) {
    const module = { exports: {} };
    vm.runInNewContext(read(`models/${role}DAO.js`), { module, require(name) {
      if (name === './Models') return Models;
      if (name === 'mongoose' || name === '../utils/MongooseUtil') return {};
      throw Error('Unexpected dependency');
    } });
    daos[role + 'DAO'] = module.exports;
    if (fallback && role !== 'Customer') delete daos[role + 'DAO'].selectByUsername;
  }
  const handlers = {};
  for (const api of ['admin', 'customer']) {
    const source = read(`api/${api}.js`);
    const start = source.indexOf("router.post('/login'");
    const end = source.indexOf('\n});', start) + 4;
    vm.runInNewContext(source.slice(start, end), {
      ...daos, Models, PasswordService, AuthRateLimit: { login() {} },
      router: { post: (url, ...handlersList) => { handlers[api] = handlersList.at(-1); } },
      JwtUtil: { genToken: payload => { tokens.push(payload); return 'synthetic-jwt'; } },
      sanitizeCustomer: account => ({ _id: account._id, username: account.username }),
      console: { error: (...args) => logs.push(args), log: (...args) => logs.push(args) }
    });
  }
  return { queries, tokens, cas, wins, reads, logs, async login(api, body) {
    const snapshot = JSON.stringify(accounts);
    const writesBefore = wins.length;
    const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handlers[api]({ body }, res);
    if (!options.beforeCas && wins.length === writesBefore) assert.equal(JSON.stringify(accounts), snapshot);
    if (!options.allowError) assert.equal(logs.length, 0);
    assert.equal(Object.hasOwn(res.data, 'password'), false);
    return res.data;
  } };
}

test('mixed login matrix: legacy migrates; bcrypt/invalid paths do not write; lookup is identity-only', async () => {
  const password = 'synthetic-password';
  const bcrypt = await PasswordService.hashPassword(password);
  for (const role of ['Admin', 'Staff', 'Customer']) {
    for (const email of role === 'Customer' ? [false, true] : [false]) {
      for (const fallback of role === 'Customer' ? [false] : [false, true]) {
        for (const stored of [password, bcrypt, '$2b$broken', '$2b$31$' + '.'.repeat(53), null, '']) {
          const account = { _id: role, username: 'user', email: 'user@example.test', password: stored, active: 1 };
          const app = setup({ [role]: account }, fallback);
          const api = role === 'Customer' ? 'customer' : 'admin';
          const identity = email ? { email: ' USER@EXAMPLE.TEST ' } : { username: role === 'Customer' ? ' user ' : 'user' };
          const valid = stored === password || stored === bcrypt;
          const result = await app.login(api, { ...identity, password });
          assert.equal(result.success, valid);
          assert.equal(app.cas.length, stored === password ? 1 : 0);
          if (stored === password) {
            assert.equal(app.cas[0].filter.password, password);
            assert.equal(await PasswordService.verifyPassword(password, account.password), true);
          }
          if (valid) {
            assert.equal(app.tokens.at(-1).role, role.toLowerCase());
            assert.equal(app.tokens.at(-1).sub, role);
          }
          assert.equal((await app.login(api, { ...identity, password: 'wrong' })).success, false);
          if (!valid && typeof stored === 'string' && stored) {
            assert.equal((await app.login(api, { ...identity, password: stored })).success, false, 'no malformed/high-cost equality fallback');
          }
        }
      }
    }
  }
});

test('role precedence, disabled statuses, unknown identities and trimming stay compatible', async () => {
  const admin = { _id: 'admin', username: 'shared', password: ' admin ' };
  const staff = { _id: 'staff', username: 'shared', password: 'staff', active: 1 };
  const app = setup({ Admin: admin, Staff: staff });
  assert.equal((await app.login('admin', { username: 'shared', password: ' admin ' })).user.role, 'admin');
  assert.equal((await app.login('admin', { username: 'shared', password: 'staff' })).user.role, 'staff');
  assert.equal((await app.login('admin', { username: 'shared', password: 'admin' })).success, false);
  staff.password = admin.password;
  assert.equal((await app.login('admin', { username: 'shared', password: ' admin ' })).user.role, 'admin');
  staff.password = ' staff ';
  for (const active of [0, -1]) {
    staff.active = active;
    assert.equal((await app.login('admin', { username: 'shared', password: staff.password })).success, false);
  }
  const customer = { _id: 'customer', username: 'user', email: 'user@example.test', password: 'pass', active: 1 };
  const customers = setup({ Customer: customer });
  for (const identity of [{ username: ' user ' }, { email: ' USER@EXAMPLE.TEST ' }]) {
    assert.equal((await customers.login('customer', { ...identity, password: ' pass ' })).success, true);
    for (const active of [0, -1]) {
      customer.active = active;
      assert.equal((await customers.login('customer', { ...identity, password: 'pass' })).success, false);
    }
    customer.active = 1;
  }
  for (const api of ['admin', 'customer']) {
    const empty = setup({});
    const missing = await empty.login(api, { username: 'unknown', password: 'pass' });
    assert.equal(missing.success, false);
    const wrong = await (api === 'admin' ? app : customers).login(api, { username: api === 'admin' ? 'shared' : 'user', password: 'wrong' });
    assert.equal(missing.message, wrong.message);
  }
});
