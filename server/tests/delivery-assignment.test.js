const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const ORDER_ID =
  '1'.repeat(24);

const ADMIN_ID =
  '2'.repeat(24);

const STAFF_A =
  '3'.repeat(24);

const STAFF_B =
  '4'.repeat(24);

function moduleStub(
  filename,
  exportsValue
) {
  return {
    id:
      filename,

    filename,

    loaded:
      true,

    exports:
      exportsValue
  };
}

function loadService(
  options = {}
) {
  const orderDaoPath =
    require.resolve(
      '../models/OrderDAO'
    );

  const modelsPath =
    require.resolve(
      '../models/Models'
    );

  const servicePath =
    require.resolve(
      '../services/DeliveryService'
    );

  const previousOrderDAO =
    require.cache[
      orderDaoPath
    ];

  const previousModels =
    require.cache[
      modelsPath
    ];

  const previousService =
    require.cache[
      servicePath
    ];

  const state = {
    order:
      options.order ===
      undefined
        ? {
            _id:
              ORDER_ID,

            status:
              'approved'
          }
        : options.order,

    staffs:
      options.staffs ||
      {
        [STAFF_A]: {
          _id:
            STAFF_A,

          name:
            'Staff A',

          active:
            1
        },

        [STAFF_B]: {
          _id:
            STAFF_B,

          name:
            'Staff B',

          active:
            1
        }
      },

    assignCalls:
      [],

    clearCalls:
      []
  };

  const fakeOrderDAO = {
    async selectByID(
      id
    ) {
      if (
        !state.order ||
        String(
          state.order
            ._id
        ) !==
        String(id)
      ) {
        return null;
      }

      return state.order;
    },

    async assignDeliveryStaff(
      id,
      assignment,
      expectedStaffId
    ) {
      state.assignCalls
        .push({
          id,
          assignment,
          expectedStaffId
        });

      if (
        options
          .assignReturnsNull
      ) {
        return null;
      }

      if (
        !state.order ||
        ![
          'approved',
          'preparing'
        ].includes(
          String(
            state.order
              .status
          ).toLowerCase()
        )
      ) {
        return null;
      }

      const currentId =
        state.order
          .delivery
          ?.assignedStaff
          ?.id
          ? String(
              state.order
                .delivery
                .assignedStaff
                .id
            )
          : '';

      if (
        expectedStaffId
      ) {
        if (
          currentId !==
          String(
            expectedStaffId
          )
        ) {
          return null;
        }
      } else if (
        currentId
      ) {
        return null;
      }

      state.order = {
        ...state.order,

        delivery: {
          ...(
            state.order
              .delivery ||
            {}
          ),

          assignedStaff:
            assignment
              .assignedStaff,

          assignedAt:
            assignment
              .assignedAt,

          assignedBy:
            assignment
              .assignedBy
        }
      };

      return state.order;
    },

    async clearDeliveryAssignment(
      id,
      expectedStaffId
    ) {
      state.clearCalls
        .push({
          id,
          expectedStaffId
        });

      if (
        options
          .clearReturnsNull
      ) {
        return null;
      }

      if (
        !state.order ||
        ![
          'approved',
          'preparing'
        ].includes(
          String(
            state.order
              .status
          ).toLowerCase()
        )
      ) {
        return null;
      }

      const currentId =
        state.order
          .delivery
          ?.assignedStaff
          ?.id
          ? String(
              state.order
                .delivery
                .assignedStaff
                .id
            )
          : '';

      if (
        currentId !==
        String(
          expectedStaffId
        )
      ) {
        return null;
      }

      state.order = {
        ...state.order,

        delivery: {
          ...(
            state.order
              .delivery ||
            {}
          ),

          assignedStaff:
            null,

          assignedAt:
            null,

          assignedBy:
            null
        }
      };

      return state.order;
    }
  };

  const fakeModels = {
    Staff: {
      findById(
        id
      ) {
        return {
          async exec() {
            return (
              state.staffs[
                String(id)
              ] ||
              null
            );
          }
        };
      }
    }
  };

  require.cache[
    orderDaoPath
  ] =
    moduleStub(
      orderDaoPath,
      fakeOrderDAO
    );

  require.cache[
    modelsPath
  ] =
    moduleStub(
      modelsPath,
      fakeModels
    );

  delete require.cache[
    servicePath
  ];

  const service =
    require(
      servicePath
    );

  function restore() {
    if (
      previousOrderDAO
    ) {
      require.cache[
        orderDaoPath
      ] =
        previousOrderDAO;
    } else {
      delete require.cache[
        orderDaoPath
      ];
    }

    if (
      previousModels
    ) {
      require.cache[
        modelsPath
      ] =
        previousModels;
    } else {
      delete require.cache[
        modelsPath
      ];
    }

    if (
      previousService
    ) {
      require.cache[
        servicePath
      ] =
        previousService;
    } else {
      delete require.cache[
        servicePath
      ];
    }
  }

  return {
    service,
    state,
    restore
  };
}

async function expectDeliveryError(
  promise,
  status,
  code
) {
  await assert.rejects(
    promise,
    error => {
      assert.equal(
        error.status,
        status
      );

      assert.equal(
        error.code,
        code
      );

      return true;
    }
  );
}

test(
  'DELIVERY-002 assignment foundation',
  async t => {
    await t.test(
      'admin assigns an active staff to approved order',
      async () => {
        const {
          service,
          state,
          restore
        } =
          loadService();

        try {
          const result =
            await service
              .assignStaff(
                ORDER_ID,

                STAFF_A,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin',

                  name:
                    'Admin'
                }
              );

          assert.equal(
            result
              .unchanged,
            false
          );

          assert.equal(
            String(
              result.order
                .delivery
                .assignedStaff
                .id
            ),
            STAFF_A
          );

          assert.equal(
            result.order
              .delivery
              .assignedStaff
              .name,
            'Staff A'
          );

          assert.equal(
            String(
              result.order
                .delivery
                .assignedBy
                .id
            ),
            ADMIN_ID
          );

          assert.equal(
            result.order
              .delivery
              .assignedBy
              .role,
            'admin'
          );

          assert.equal(
            result.order
              .delivery
              .assignedBy
              .name,
            'Admin'
          );

          assert.ok(
            Number
              .isSafeInteger(
                result.order
                  .delivery
                  .assignedAt
              )
          );

          assert.equal(
            state
              .assignCalls
              .length,
            1
          );

          assert.equal(
            state
              .assignCalls[0]
              .expectedStaffId,
            null
          );
        } finally {
          restore();
        }
      }
    );

    await t.test(
      'preparing order can be reassigned with CAS on previous staff',
      async () => {
        const {
          service,
          state,
          restore
        } =
          loadService({
            order: {
              _id:
                ORDER_ID,

              status:
                'preparing',

              delivery: {
                assignedStaff: {
                  id:
                    STAFF_A,

                  name:
                    'Staff A'
                },

                assignedAt:
                  1,

                assignedBy: {
                  id:
                    ADMIN_ID,

                  role:
                    'admin',

                  name:
                    'Admin'
                }
              }
            }
          });

        try {
          const result =
            await service
              .assignStaff(
                ORDER_ID,

                STAFF_B,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              );

          assert.equal(
            result
              .unchanged,
            false
          );

          assert.equal(
            String(
              result.order
                .delivery
                .assignedStaff
                .id
            ),
            STAFF_B
          );

          assert.equal(
            state
              .assignCalls
              .length,
            1
          );

          assert.equal(
            state
              .assignCalls[0]
              .expectedStaffId,
            STAFF_A
          );
        } finally {
          restore();
        }
      }
    );

    await t.test(
      'retry assigning the same staff is a no-op',
      async () => {
        const {
          service,
          state,
          restore
        } =
          loadService({
            order: {
              _id:
                ORDER_ID,

              status:
                'approved',

              delivery: {
                assignedStaff: {
                  id:
                    STAFF_A,

                  name:
                    'Staff A'
                },

                assignedAt:
                  123,

                assignedBy: {
                  id:
                    ADMIN_ID,

                  role:
                    'admin',

                  name:
                    'Admin'
                }
              }
            }
          });

        try {
          const result =
            await service
              .assignStaff(
                ORDER_ID,

                STAFF_A,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              );

          assert.equal(
            result
              .unchanged,
            true
          );

          assert.equal(
            state
              .assignCalls
              .length,
            0
          );

          assert.equal(
            result.order
              .delivery
              .assignedAt,
            123
          );
        } finally {
          restore();
        }
      }
    );

    await t.test(
      'admin can clear assignment and retry is a no-op',
      async () => {
        const {
          service,
          state,
          restore
        } =
          loadService({
            order: {
              _id:
                ORDER_ID,

              status:
                'approved',

              delivery: {
                assignedStaff: {
                  id:
                    STAFF_A,

                  name:
                    'Staff A'
                },

                assignedAt:
                  123,

                assignedBy: {
                  id:
                    ADMIN_ID,

                  role:
                    'admin',

                  name:
                    'Admin'
                }
              }
            }
          });

        try {
          const first =
            await service
              .clearAssignment(
                ORDER_ID,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              );

          assert.equal(
            first
              .unchanged,
            false
          );

          assert.equal(
            first.order
              .delivery
              .assignedStaff,
            null
          );

          assert.equal(
            state
              .clearCalls
              .length,
            1
          );

          assert.equal(
            state
              .clearCalls[0]
              .expectedStaffId,
            STAFF_A
          );

          const second =
            await service
              .clearAssignment(
                ORDER_ID,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              );

          assert.equal(
            second
              .unchanged,
            true
          );

          assert.equal(
            state
              .clearCalls
              .length,
            1
          );
        } finally {
          restore();
        }
      }
    );

    await t.test(
      'staff cannot assign or clear delivery assignment',
      async () => {
        const {
          service,
          restore
        } =
          loadService();

        try {
          await expectDeliveryError(
            service.assignStaff(
              ORDER_ID,

              STAFF_A,

              {
                id:
                  STAFF_A,

                role:
                  'staff'
              }
            ),

            403,

            'DELIVERY_ASSIGNMENT_FORBIDDEN'
          );

          await expectDeliveryError(
            service.clearAssignment(
              ORDER_ID,

              {
                id:
                  STAFF_A,

                role:
                  'staff'
              }
            ),

            403,

            'DELIVERY_ASSIGNMENT_FORBIDDEN'
          );
        } finally {
          restore();
        }
      }
    );

    await t.test(
      'invalid ids, missing order/staff and inactive staff fail closed',
      async () => {
        {
          const {
            service,
            restore
          } =
            loadService();

          try {
            await expectDeliveryError(
              service.assignStaff(
                'bad',

                STAFF_A,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              ),

              400,

              'INVALID_ORDER_ID'
            );

            await expectDeliveryError(
              service.assignStaff(
                ORDER_ID,

                'bad',

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              ),

              400,

              'INVALID_STAFF_ID'
            );
          } finally {
            restore();
          }
        }

        {
          const {
            service,
            restore
          } =
            loadService({
              order:
                null
            });

          try {
            await expectDeliveryError(
              service.assignStaff(
                ORDER_ID,

                STAFF_A,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              ),

              404,

              'ORDER_NOT_FOUND'
            );
          } finally {
            restore();
          }
        }

        {
          const {
            service,
            restore
          } =
            loadService({
              staffs:
                {}
            });

          try {
            await expectDeliveryError(
              service.assignStaff(
                ORDER_ID,

                STAFF_A,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              ),

              404,

              'STAFF_NOT_FOUND'
            );
          } finally {
            restore();
          }
        }

        {
          const {
            service,
            restore
          } =
            loadService({
              staffs: {
                [STAFF_A]: {
                  _id:
                    STAFF_A,

                  name:
                    'Staff A',

                  active:
                    0
                }
              }
            });

          try {
            await expectDeliveryError(
              service.assignStaff(
                ORDER_ID,

                STAFF_A,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              ),

              409,

              'STAFF_INACTIVE'
            );
          } finally {
            restore();
          }
        }
      }
    );

    await t.test(
      'pending, delivering and terminal orders cannot be assigned',
      async () => {
        for (
          const status of [
            'pending',
            'delivering',
            'completed',
            'canceled'
          ]
        ) {
          const {
            service,
            restore
          } =
            loadService({
              order: {
                _id:
                  ORDER_ID,

                status
              }
            });

          try {
            await expectDeliveryError(
              service.assignStaff(
                ORDER_ID,

                STAFF_A,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              ),

              409,

              'ORDER_NOT_ASSIGNABLE'
            );
          } finally {
            restore();
          }
        }
      }
    );

    await t.test(
      'concurrent status/assignment changes return stale conflict',
      async () => {
        {
          const {
            service,
            restore
          } =
            loadService({
              assignReturnsNull:
                true
            });

          try {
            await expectDeliveryError(
              service.assignStaff(
                ORDER_ID,

                STAFF_A,

                {
                  id:
                    ADMIN_ID,

                  role:
                    'admin'
                }
              ),

              409,

              'DELIVERY_ASSIGNMENT_STALE'
            );
          } finally {
            restore();
          }
        }

        {
          const {
            service,
            restore
          } =
            loadService({
              clearReturnsNull:
                true,

              order: {
                _id:
                  ORDER_ID,

                status:
                  'approved',

                delivery: {
                  assignedStaff: {
                    id:
                      STAFF_A,

                    name:
                      'Staff A'
                  }
                }
              }
            });

          try {
            await expectDeliveryError(
              service
                .clearAssignment(
                  ORDER_ID,

                  {
                    id:
                      ADMIN_ID,

                    role:
                      'admin'
                  }
                ),

              409,

              'DELIVERY_ASSIGNMENT_STALE'
            );
          } finally {
            restore();
          }
        }
      }
    );
  }
);