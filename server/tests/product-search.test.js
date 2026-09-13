const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Load only the subject with explicit mocks:
// never load dotenv or connect to Atlas.
function load(
  relative,
  dependencies
) {
  const module = {
    exports: {}
  };

  const source =
    fs.readFileSync(
      path.join(
        __dirname,
        '..',
        relative
      ),
      'utf8'
    );

  new Function(
    'require',
    'module',
    'exports',
    source
  )(
    name => {
      if (
        !(name in dependencies)
      ) {
        throw new Error(
          'Unexpected dependency'
        );
      }

      return dependencies[
        name
      ];
    },

    module,
    module.exports
  );

  return module.exports;
}

function fixture(
  rows = [],
  failure = null
) {
  const calls = [];

  const chain = {};

  for (
    const method of [
      'select',
      'sort',
      'limit',
      'maxTimeMS',
      'lean'
    ]
  ) {
    chain[method] =
      value => {
        calls.push([
          method,
          value
        ]);

        return chain;
      };
  }

  chain.exec =
    async () => {
      if (failure) {
        throw failure;
      }

      return rows;
    };

  const dao =
    load(
      'models/ProductDAO.js',
      {
        '../utils/MongooseUtil':
          {},

        mongoose: {
          Types: {
            ObjectId:
              class {
                constructor(
                  id
                ) {
                  this.id =
                    id;
                }
              }
          }
        },

        './Models': {
          Product: {
            find(
              filter
            ) {
              calls.push([
                'find',
                filter
              ]);

              return chain;
            }
          }
        }
      }
    );

  const tool =
    load(
      'services/ai/tools/ProductSearchTool.js',
      {
        '../../../models/ProductDAO':
          dao
      }
    );

  return {
    dao,
    tool,
    calls
  };
}

test(
  'rejects invalid values and raw operators before any database call',
  async () => {
    const {
      tool,
      calls
    } = fixture();

    const invalid = [
      null,
      [],
      'hoa',
      {
        $where: 'x'
      },
      {
        filter: {}
      },
      {
        keywords: [
          {
            $ne: null
          }
        ]
      },
      {
        keywords: []
      },
      {
        keywords:
          Array(7).fill(
            'hoa'
          )
      },
      {
        keywords: [
          'hoa'
        ],
        keyword:
          'hoa'
      },
      {
        excludeIds: [
          'invalid'
        ]
      },
      {
        excludeIds: {
          $ne: null
        }
      },
      {
        keyword: {
          $ne: null
        }
      },
      {
        keyword: ''
      },
      {
        keyword: '   '
      },
      {
        keyword:
          'a'.repeat(
            201
          )
      },
      {
        category: {
          $gt: ''
        }
      },
      {
        category:
          'birthday'
      },
      {
        category: ''
      },
      {
        minPrice:
          '100'
      },
      {
        minPrice: -1
      },
      {
        maxPrice:
          Infinity
      },
      {
        minPrice:
          NaN
      },
      {
        maxPrice:
          null
      },
      {
        minPrice: 2,
        maxPrice: 1
      },
      {
        stock: {
          $gt: 0
        }
      },
      {
        availability:
          true
      },
      {
        availability:
          null
      },
      {
        availability:
          'available'
      },
      {
        limit: 0
      },
      {
        inStockOnly:
          'true'
      },
      {
        inStockOnly:
          true,
        availability:
          'all'
      },
      {
        limit: 1.5
      },
      {
        limit:
          '3'
      },
      {
        occasion:
          'sinh nhật'
      },

      JSON.parse(
        '{"__proto__":{"limit":100}}'
      )
    ];

    for (
      const input of invalid
    ) {
      await assert.rejects(
        tool.searchProducts(
          input
        ),
        {
          code:
            'INVALID_PRODUCT_SEARCH_INPUT'
        }
      );
    }

    assert.equal(
      calls.length,
      0
    );
  }
);

test(
  'context terms are ANDed literal searches and exclusions are bounded IDs',
  async () => {
    const {
      dao,
      calls
    } = fixture();

    await dao.searchForAssistant({
      keywords: [
        'sinh nhật',
        'hồng.*'
      ],

      excludeIds: [
        '111111111111111111111111'
      ],

      maxPrice:
        1000000
    });

    const filter =
      calls[0][1];

    assert.equal(
      filter.$and.length,
      2
    );

    assert.ok(
      filter.$and[1]
        .$or[0]
        .name
        .$regex
        .test(
          'hồng.*'
        )
    );

    assert.equal(
      filter.$and[1]
        .$or[0]
        .name
        .$regex
        .test(
          'hồng đỏ'
        ),
      false
    );

    assert.equal(
      filter._id
        .$nin[0].id,
      '111111111111111111111111'
    );

    assert.equal(
      filter.price.$lte,
      1000000
    );
  }
);

test(
  'defaults to available stock, bounded query, minimal projection',
  async () => {
    const {
      tool,
      calls
    } = fixture();

    assert.deepEqual(
      await tool.searchProducts(),
      []
    );

    assert.deepEqual(
      calls[0],
      [
        'find',
        {
          stock: {
            $gt: 0
          }
        }
      ]
    );

    assert.ok(
      calls.some(
        ([
          method,
          value
        ]) =>
          method ===
            'limit' &&
          value === 5
      )
    );

    assert.ok(
      calls.some(
        ([
          method,
          value
        ]) =>
          method ===
            'maxTimeMS' &&
          value === 3000
      )
    );

    const selectCall =
      calls.find(
        ([
          method
        ]) =>
          method ===
          'select'
      );

    assert.ok(
      selectCall,
      'ProductDAO must use an explicit projection'
    );

    /*
     * Order of Mongoose projection fields is
     * irrelevant, but the allowed field set
     * must stay minimal and explicit.
     */
    const projection =
      selectCall[1]
        .trim()
        .split(/\s+/)
        .sort();

    const expectedProjection =
      [
        '_id',
        'name',
        'price',
        'image',
        'category._id',
        'category.name',
        'submenu._id',
        'submenu.name',
        'description',
        'stock'
      ].sort();

    assert.deepEqual(
      projection,
      expectedProjection
    );
  }
);

test(
  'clamps oversized limit and supports boolean stock option',
  async () => {
    const {
      dao,
      calls
    } = fixture();

    await dao.searchForAssistant({
      inStockOnly:
        true,

      limit:
        999
    });

    assert.deepEqual(
      calls[0][1],
      {
        stock: {
          $gt: 0
        }
      }
    );

    assert.ok(
      calls.some(
        ([
          method,
          value
        ]) =>
          method ===
            'limit' &&
          value === 5
      )
    );

    calls.length = 0;

    await dao.searchForAssistant({
      inStockOnly:
        false
    });

    assert.deepEqual(
      calls[0][1],
      {}
    );
  }
);

test(
  'combines category, inclusive price bounds and literal keyword safely',
  async () => {
    const {
      dao,
      calls
    } = fixture();

    const category =
      '0123456789abcdef01234567';

    await dao.searchForAssistant({
      keyword:
        ' .*[$] ',

      category,

      minPrice:
        0,

      maxPrice:
        500000,

      limit:
        3
    });

    const filter =
      calls[0][1];

    assert.equal(
      filter[
        'category._id'
      ].id,
      category
    );

    assert.deepEqual(
      filter.price,
      {
        $gte: 0,
        $lte:
          500000
      }
    );

    assert.deepEqual(
      filter.stock,
      {
        $gt: 0
      }
    );

    assert.equal(
      filter.$or.length,
      4
    );

    const regex =
      filter.$or[0]
        .name
        .$regex;

    assert.ok(
      regex.test(
        'hoa .*[$]'
      )
    );

    assert.equal(
      regex.test(
        'anything'
      ),
      false
    );

    assert.ok(
      calls.some(
        ([
          method,
          value
        ]) =>
          method ===
            'limit' &&
          value === 3
      )
    );
  }
);

test(
  'availability modes are explicit and price can have either bound',
  async () => {
    const {
      dao,
      calls
    } = fixture();

    await dao.searchForAssistant({
      availability:
        'out_of_stock',

      maxPrice:
        0
    });

    assert.deepEqual(
      calls[0][1],
      {
        stock: {
          $lte: 0
        },

        price: {
          $lte: 0
        }
      }
    );

    calls.length = 0;

    await dao.searchForAssistant({
      availability:
        'all',

      minPrice:
        10
    });

    assert.deepEqual(
      calls[0][1],
      {
        price: {
          $gte: 10
        }
      }
    );
  }
);

test(
  'returns only approved projected database values; omits incomplete legacy records',
  async () => {
    const row = {
      _id:
        '0123456789abcdef01234567',

      name:
        'Hoa hồng',

      price:
        250000,

      stock:
        2,

      image:
        '/hoa.png',

      category: {
        _id:
          '1123456789abcdef01234567',

        name:
          'Bó hoa'
      },

      description:
        'private extra',

      discountPrice:
        200000
    };

    const {
      tool
    } = fixture([
      row,

      {
        ...row,
        price:
          undefined
      },

      {
        ...row,
        stock:
          undefined
      }
    ]);

    assert.deepEqual(
      await tool.searchProducts(),
      [
        {
          id:
            row._id,

          name:
            row.name,

          price:
            250000,

          image:
            row.image,

          category: {
            id:
              row.category._id,

            name:
              'Bó hoa'
          },

          submenu:
            null,

          description:
            'private extra',

          stock:
            2
        }
      ]
    );
  }
);

test(
  'database failures/timeouts are sanitized, not disguised as no matches',
  async () => {
    const {
      tool
    } = fixture(
      [],
      new Error(
        'sensitive connection details'
      )
    );

    await assert.rejects(
      tool.searchProducts(),
      error => {
        assert.equal(
          error.code,
          'PRODUCT_SEARCH_UNAVAILABLE'
        );

        assert.equal(
          error.message,
          'Product search is unavailable'
        );

        assert.equal(
          error.cause,
          undefined
        );

        return true;
      }
    );
  }
);