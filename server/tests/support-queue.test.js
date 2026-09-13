const test = require('node:test');
const assert = require('node:assert/strict');

test(
  'DAO transition uses atomic prior-state filter and only assigns on acceptance',
  async t => {
    const modelsPath =
      require.resolve(
        '../models/Models'
      );

    const daoPath =
      require.resolve(
        '../models/SupportRequestDAO'
      );

    const oldModels =
      require.cache[
        modelsPath
      ];

    const oldDAO =
      require.cache[
        daoPath
      ];

    t.after(() => {
      if (oldModels) {
        require.cache[
          modelsPath
        ] =
          oldModels;
      } else {
        delete require.cache[
          modelsPath
        ];
      }

      if (oldDAO) {
        require.cache[
          daoPath
        ] =
          oldDAO;
      } else {
        delete require.cache[
          daoPath
        ];
      }
    });

    const calls = [];

    require.cache[
      modelsPath
    ] = {
      exports: {
        SupportRequest: {
          findOneAndUpdate(
            ...args
          ) {
            calls.push(
              args
            );

            return {
              select() {
                return this;
              },

              maxTimeMS() {
                return this;
              },

              lean() {
                return this;
              },

              async exec() {
                return null;
              }
            };
          }
        }
      }
    };

    delete require.cache[
      daoPath
    ];

    const dao =
      require(
        '../models/SupportRequestDAO'
      );

    const actor = {
      id: 'actor',
      role: 'staff',
      name: 'Staff'
    };

    await dao.transition(
      'id',
      'in_progress',
      actor
    );

    assert.deepEqual(
      calls[0][0],
      {
        _id: 'id',
        status: 'pending'
      }
    );

    assert.deepEqual(
      calls[0][1],
      {
        $set: {
          status:
            'in_progress',

          assignedTo:
            actor
        }
      }
    );

    await dao.transition(
      'id',
      'resolved',
      actor
    );

    assert.deepEqual(
      calls[1][0],
      {
        _id: 'id',
        status:
          'in_progress',

        'assignedTo.id':
          actor.id,

        'assignedTo.role':
          'staff'
      }
    );

    assert.equal(
      calls[1][1].$set
        .status,
      'resolved'
    );

    assert.deepEqual(
      calls[1][1].$set
        .resolvedBy,
      actor
    );

    assert.ok(
      calls[1][1].$set
        .resolvedAt
        instanceof Date
    );

    await dao.transition(
      'id',
      'resolved',
      {
        ...actor,
        role: 'admin'
      }
    );

    assert.deepEqual(
      calls[2][0],
      {
        _id: 'id',
        status:
          'in_progress'
      }
    );
  }
);

test(
  'support admin API enforces JWT, roles, filters, IDs and transitions',
  async t => {
    const jwt =
      require(
        'jsonwebtoken'
      );

    const express =
      require(
        'express'
      );

    const id =
      '111111111111111111111111';

    let status =
      'pending';

    let failure =
      false;

    const notifications =
      [];

    const row = () => ({
      _id: id,
      status,
      orderId:
        '222222222222222222222222'
    });

    const actorQuery = {
      select() {
        return this;
      },

      lean() {
        return this;
      },

      async exec() {
        return {
          _id: id,
          username:
            'operator',
          active: 1,
          tokenVersion: 0
        };
      }
    };

    const accountModel = {
      findById() {
        return actorQuery;
      }
    };

    const overrides = {
      '../realtime/supportChat': {
        async publish() {},

        async publishAdmins(
          event,
          request
        ) {
          assert.equal(
            request.status,
            status
          );

          notifications.push({
            event,
            status:
              request.status
          });
        }
      },

      '../utils/MyConstants': {
        JWT_SECRET:
          'queue-test-secret',

        JWT_EXPIRES:
          '1h'
      },

      '../models/Models': {
        Admin:
          accountModel,

        Staff:
          accountModel,

        // Required by the hardened JwtUtil.verifySession()
        // so a valid customer token reaches the RBAC
        // check and is rejected as 403 instead of 401.
        Customer:
          accountModel
      },

      '../models/SupportRequestDAO': {
        async list(filters) {
          if (failure) {
            throw Error(
              'private'
            );
          }

          return {
            requests:
              filters.status &&
              filters.status !==
                status
                ? []
                : [
                    row()
                  ],

            stats: {
              total: 1
            },

            total: 1
          };
        },

        async detail(value) {
          return value === id
            ? row()
            : null;
        },

        async transition(
          value,
          next,
          actor
        ) {
          if (failure) {
            throw Error(
              'private'
            );
          }

          assert.equal(
            actor.id,
            id
          );

          assert.equal(
            actor.name,
            'operator'
          );

          if (
            value !== id ||
            (
              next ===
                'in_progress'
                ? status !==
                  'pending'
                : status !==
                  'in_progress'
            )
          ) {
            return null;
          }

          status =
            next;

          return row();
        }
      }
    };

    for (
      const [
        name,
        exports
      ] of Object.entries(
        overrides
      )
    ) {
      const resolved =
        require.resolve(
          name
        );

      const previous =
        require.cache[
          resolved
        ];

      require.cache[
        resolved
      ] = {
        exports
      };

      t.after(() => {
        if (previous) {
          require.cache[
            resolved
          ] =
            previous;
        } else {
          delete require.cache[
            resolved
          ];
        }
      });
    }

    const app =
      express();

    app.use(
      express.json()
    );

    app.use(
      '/api/admin/support-requests',
      require(
        '../api/support'
      )
    );

    const server =
      app.listen(
        0,
        '127.0.0.1'
      );

    await new Promise(
      resolve =>
        server.once(
          'listening',
          resolve
        )
    );

    async function request(
      path = '',
      role = 'admin',
      body
    ) {
      const token =
        jwt.sign(
          {
            sub: id,
            role,
            tokenVersion: 0
          },

          'queue-test-secret'
        );

      const response =
        await fetch(
          `http://127.0.0.1:${server.address().port}/api/admin/support-requests${path}`,
          {
            method:
              body
                ? 'PATCH'
                : 'GET',

            headers: {
              Authorization:
                `Bearer ${token}`,

              'Content-Type':
                'application/json'
            },

            ...(body
              ? {
                  body:
                    JSON.stringify(
                      body
                    )
                }
              : {})
          }
        );

      return {
        status:
          response.status,

        body:
          await response.json()
      };
    }

    try {
      assert.equal(
        (
          await request(
            '',
            'customer'
          )
        ).status,
        403
      );

      assert.equal(
        (
          await request(
            '?status=pending',
            'staff'
          )
        ).body.requests.length,
        1
      );

      assert.equal(
        (
          await request(
            '?status[$ne]=resolved'
          )
        ).status,
        400
      );

      assert.equal(
        (
          await request(
            '/invalid'
          )
        ).status,
        400
      );

      assert.equal(
        (
          await request(
            '/333333333333333333333333'
          )
        ).status,
        404
      );

      assert.equal(
        (
          await request(
            `/${id}`
          )
        ).body.request.orderId,
        row().orderId
      );

      assert.equal(
        (
          await request(
            `/${id}/status`,
            'admin',
            {
              status:
                'resolved'
            }
          )
        ).status,
        409
      );

      assert.equal(
        (
          await request(
            `/${id}/status`,
            'admin',
            {
              status:
                'in_progress',

              assignedTo:
                'fake'
            }
          )
        ).status,
        400
      );

      assert.equal(
        (
          await request(
            `/${id}/status`,
            'admin',
            {
              status:
                'in_progress'
            }
          )
        ).body.request.status,
        'in_progress'
      );

      assert.deepEqual(
        notifications,
        [
          {
            event:
              'support:updated',

            status:
              'in_progress'
          }
        ]
      );

      failure =
        true;

      assert.equal(
        (
          await request(
            `/${id}/status`,
            'staff',
            {
              status:
                'resolved'
            }
          )
        ).status,
        500
      );

      assert.equal(
        notifications.length,
        1
      );

      failure =
        false;

      assert.equal(
        (
          await request(
            `/${id}/status`,
            'staff',
            {
              status:
                'resolved'
            }
          )
        ).body.request.status,
        'resolved'
      );

      assert.deepEqual(
        notifications[1],
        {
          event:
            'support:updated',

          status:
            'resolved'
        }
      );

      assert.equal(
        (
          await request(
            `/${id}/status`,
            'admin',
            {
              status:
                'pending'
            }
          )
        ).status,
        400
      );

      assert.equal(
        (
          await request(
            '?status=pending'
          )
        ).body.requests.length,
        0
      );

      failure =
        true;

      const failed =
        await request();

      assert.equal(
        failed.status,
        500
      );

      assert.ok(
        !JSON.stringify(
          failed
        ).includes(
          'private'
        )
      );
    } finally {
      await new Promise(
        resolve =>
          server.close(
            resolve
          )
      );
    }
  }
);