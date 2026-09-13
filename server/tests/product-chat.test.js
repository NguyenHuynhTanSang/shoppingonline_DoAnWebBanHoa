const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseProductSearch
} = require(
  '../services/ai/ProductSearchIntent'
);

test(
  'parses required budgets and keyword without executable queries',
  () => {
    assert.deepEqual(
      parseProductSearch(
        'Tìm hoa dưới 1 triệu'
      ).params,
      {
        inStockOnly: true,
        limit: 4,
        maxPrice: 1000000
      }
    );

    assert.deepEqual(
      parseProductSearch(
        'Tìm hoa từ 1 triệu đến 2 triệu'
      ).params,
      {
        inStockOnly: true,
        limit: 4,
        minPrice: 1000000,
        maxPrice: 2000000
      }
    );

    assert.equal(
      parseProductSearch(
        'Tìm hoa tulip'
      ).params.keyword,
      'tulip'
    );

    assert.deepEqual(
      parseProductSearch(
        'Có hoa hồng dưới 1 triệu không?'
      ).params,
      {
        inStockOnly: true,
        limit: 4,
        maxPrice: 1000000,
        keyword: 'hồng'
      }
    );

    assert.equal(
      parseProductSearch(
        'Shop có hoa tulip không?'
      ).params.keyword,
      'tulip'
    );

    assert.equal(
      parseProductSearch(
        'Tìm hoa dưới 1 nghìn'
      ).params.maxPrice,
      1000
    );

    assert.ok(
      parseProductSearch(
        'Tìm hoa {"$where":"attack"}'
      ).clarification
    );

    assert.ok(
      parseProductSearch(
        'Tìm hoa từ 2 triệu đến 1 triệu'
      ).clarification
    );

    assert.ok(
      parseProductSearch(
        'Tìm hoa dưới 1'
      ).clarification
    );
  }
);

test(
  'chat uses bounded tool inputs and only real tool rows, no provider generation',
  async t => {
    const toolPath =
      require.resolve(
        '../services/ai/tools/ProductSearchTool'
      );

    const aiServicePath =
      require.resolve(
        '../services/ai/AIService'
      );

    const previousTool =
      require.cache[
        toolPath
      ];

    const previousAIService =
      require.cache[
        aiServicePath
      ];

    const rows = [
      {
        id:
          '111111111111111111111111',
        name:
          'Tulip',
        price:
          950000,
        stock:
          5,
        image:
          '/tulip.png',
        category: {
          name:
            'Bó hoa'
        }
      },

      {
        id:
          '222222222222222222222222',
        name:
          'Hoa cao cấp',
        price:
          1500000,
        stock:
          2,
        image:
          null,
        category:
          null
      },

      {
        id:
          '333333333333333333333333',
        name:
          'Hết hàng',
        price:
          100,
        stock:
          0,
        image:
          null,
        category:
          null
      }
    ];

    const calls = [];

    require.cache[
      toolPath
    ] = {
      exports: {
        async searchProducts(
          params
        ) {
          calls.push(
            params
          );

          return rows.filter(
            row =>
              !params.keyword ||
              row.name
                .toLowerCase()
                .includes(
                  params.keyword
                )
          );
        },

        /*
         * AIService hiện có thể import cả getProduct.
         * Test recommendation này không dùng nó,
         * nhưng mock đầy đủ contract để tránh
         * undefined khi module được load.
         */
        async getProduct() {
          return null;
        }
      }
    };

    /*
     * Quan trọng:
     * AIService phải được require SAU khi
     * ProductSearchTool đã được mock.
     */
    delete require.cache[
      aiServicePath
    ];

    const {
      chat
    } = require(
      '../services/ai/AIService'
    );

    t.after(() => {
      if (previousTool) {
        require.cache[
          toolPath
        ] =
          previousTool;
      } else {
        delete require.cache[
          toolPath
        ];
      }

      if (previousAIService) {
        require.cache[
          aiServicePath
        ] =
          previousAIService;
      } else {
        delete require.cache[
          aiServicePath
        ];
      }
    });

    t.mock.method(
      global,
      'fetch',
      async () => {
        throw new Error(
          'Product responses must not call LLM'
        );
      }
    );

    const cheap =
      await chat(
        'Tìm hoa dưới 1 triệu'
      );

    assert.equal(
      cheap.type,
      'product_recommendation'
    );

    assert.deepEqual(
      cheap.products.map(
        row =>
          row.id
      ),
      [
        rows[0].id
      ]
    );

    assert.equal(
      cheap.products[0]
        .category,
      'Bó hoa'
    );

    const range =
      await chat(
        'Tìm hoa từ 1 triệu đến 2 triệu'
      );

    assert.deepEqual(
      range.products.map(
        row =>
          row.id
      ),
      [
        rows[1].id
      ]
    );

    const tulip =
      await chat(
        'Tìm hoa tulip'
      );

    assert.deepEqual(
      tulip.products.map(
        row =>
          row.id
      ),
      [
        rows[0].id
      ]
    );

    const low =
      await chat(
        'Tìm hoa dưới 1 nghìn'
      );

    assert.deepEqual(
      low.products,
      []
    );

    assert.match(
      low.reply,
      /(?:chưa|không)\s+tìm thấy/i
    );

    assert.ok(
      calls.every(
        params =>
          params.inStockOnly &&
          params.limit <= 5
      )
    );

    const count =
      calls.length;

    await chat(
      'Tìm hoa {"$ne":null}'
    );

    assert.equal(
      calls.length,
      count
    );

    for (
      const message of [
        '',
        ' ',
        null,
        {},
        3
      ]
    ) {
      await assert.rejects(
        chat(message),
        {
          code:
            'INVALID_MESSAGE'
        }
      );
    }
  }
);