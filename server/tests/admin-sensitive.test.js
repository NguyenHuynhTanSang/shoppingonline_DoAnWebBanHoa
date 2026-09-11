const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Admin account responses are safe on DAO/fallback paths and blank staff password is preserved', async () => {
  const express = require('express');
  for (const fallback of [false, true]) {
    const staff = { _id: '111111111111111111111111', username: 'staff', name: 'Staff Test', password: 'synthetic-old', email: 'staff@example.test', active: 1, cdate: 1, udate: 2, futureSecret: 'synthetic-private' };
    const customer = { ...staff, username: 'customer', token: 'synthetic-activation', resetPasswordToken: 'synthetic-reset', resetPasswordExpire: 123 };
    customer.save = async () => customer;
    const query = value => ({ sort() { return this; }, async exec() { return value; } });
    const update = value => { Object.assign(staff, value); return staff; };
    const pass = (req, res, next) => next();
    const dependencies = {
      express, mongoose: require('mongoose'),
      '../utils/JwtUtil': { checkToken: pass, requireRoles: () => pass },
      '../models/AdminDAO': {}, '../models/CategoryDAO': {}, '../models/ProductDAO': {},
      '../models/OrderDAO': {},
      '../models/CustomerDAO': fallback ? {} : { selectAll: async () => [customer] },
      '../models/StaffDAO': fallback ? {} : { selectAll: async () => [staff], selectByID: async () => staff, insert: async value => update(value), update: async value => update(value), setActive: async (id, active) => update({ active }) },
      '../models/Models': {
        Staff: { find: () => query([staff]), findById: () => query(staff), findOne: () => query(null), create: async value => update(value), findByIdAndUpdate: (id, value) => query(update(value)) },
        Customer: { find: () => query([customer]), findById: () => query(customer) }
      }
    };
    const module = { exports: {} };
    new Function('require', 'module', fs.readFileSync(path.join(__dirname, '../api/admin.js'), 'utf8'))(name => {
      if (!(name in dependencies)) throw Error('Unexpected dependency ' + name); return dependencies[name];
    }, module);
    const app = express(); app.use(express.json()); app.use('/api/admin', module.exports);
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const safe = value => {
      for (const key of ['password', 'token', 'resetPasswordToken', 'resetPasswordExpire', 'futureSecret']) assert.equal(Object.hasOwn(value, key), false, key);
      assert.ok(value._id && value.username && value.name);
    };
    async function request(route, method = 'GET', body) {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/admin${route}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.equal(res.status, 200); const data = await res.json(); assert.equal(data.success, true); return data;
    }
    try {
      safe((await request('/staffs')).staffs[0]); safe((await request('/customers')).customers[0]);
      for (const password of [undefined, '', '   ']) {
        const before = staff.password;
        safe((await request('/staffs/' + staff._id, 'PUT', { name: 'Edited', password })).staff);
        assert.equal(staff.password, before);
      }
      safe((await request('/staffs/' + staff._id, 'PUT', { password: 'synthetic-new' })).staff);
      assert.equal(staff.password, 'synthetic-new');
      safe((await request('/staff', 'POST', { username: 'newstaff', name: 'New', password: 'synthetic-created' })).staff);
      assert.equal(staff.password, 'synthetic-created');
      safe((await request('/staffs/' + staff._id + '/status', 'PUT', { active: 0 })).staff); assert.equal(staff.active, 0);
      safe((await request('/customers/' + customer._id + '/status', 'PUT', { active: -1 })).customer); assert.equal(customer.active, -1);
      assert.equal(customer.token, 'synthetic-activation');
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
});
