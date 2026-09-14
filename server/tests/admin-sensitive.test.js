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
    const order = { _id: '222222222222222222222222', status: 'pending', total: 100, items: [], customer };
    order.save = async () => order;
    const query = value => ({ sort() { return this; }, async exec() { return value; } });
    const update = value => { Object.assign(staff, value.$set || value); if (value.$inc) staff.tokenVersion = (staff.tokenVersion || 0) + value.$inc.tokenVersion; return staff; };
    const pass = (req, res, next) => { req.decoded = { role: 'admin' }; next(); };
    const dependencies = {
      '../services/OrderLifecycleService': { async transition(id, status) { order.status = status; return { order }; } },
      '../services/DeliveryService': {},
      '../services/PasswordService': require('../services/PasswordService'),
      '../utils/OrderStateMachine': require('../utils/OrderStateMachine'),
      '../utils/AuthRateLimit': require('../utils/AuthRateLimit'),
      express, mongoose: require('mongoose'), './support': express.Router(),
      '../utils/JwtUtil': { checkToken: pass, requireRoles: () => pass },
      '../models/AdminDAO': {}, '../models/CategoryDAO': {}, '../models/ProductDAO': {},
      '../models/OrderDAO': { selectAll: async () => [order], selectByCustID: async () => [order] },
      '../models/CustomerDAO': fallback ? {} : { selectAll: async () => [customer] },
      '../models/StaffDAO': fallback ? {} : { selectAll: async () => [staff], selectByID: async () => staff, insert: async value => update(value), update: async value => update(value), setActive: async (id, active) => update({ active }) },
      '../models/Models': {
        Staff: { find: () => query([staff]), findById: () => query(staff), findOne: () => query(null), create: async value => update(value), findByIdAndUpdate: (id, value) => query(update(value)) },
        Customer: { find: () => query([customer]), findById: () => query(customer) },
        Order: { findById: () => query(order) }
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
      assert.equal(await require('../services/PasswordService').verifyPassword('synthetic-new', staff.password), true);
      for (const password of [undefined, '', '   ']) {
        const before = staff.password;
        safe((await request('/staffs/' + staff._id, 'PUT', { name: 'Edited', password })).staff);
        assert.equal(staff.password, before);
      }
      safe((await request('/staff', 'POST', { username: 'newstaff', name: 'New', password: 'synthetic-created' })).staff);
      assert.equal(await require('../services/PasswordService').verifyPassword('synthetic-created', staff.password), true);
      safe((await request('/staffs/' + staff._id + '/status', 'PUT', { active: 0 })).staff); assert.equal(staff.active, 0);
      safe((await request('/customers/' + customer._id + '/status', 'PUT', { active: -1 })).customer); assert.equal(customer.active, -1);
      assert.equal(customer.token, 'synthetic-activation');
      for (const route of ['/orders', '/orders/customer/' + customer._id]) safe((await request(route)).orders[0].customer);
      safe((await request('/orders/' + order._id + '/status', 'PUT', { status: 'pending' })).order.customer);
      safe((await request('/orders/' + order._id + '/status', 'PUT', { status: 'approved' })).order.customer);
      assert.equal(order.customer.password, 'synthetic-old');
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
});
