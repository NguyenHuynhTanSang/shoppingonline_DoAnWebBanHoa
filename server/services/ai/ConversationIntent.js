const { parseProductSearch } = require('./ProductSearchIntent');
const { safeMessage } = require('./HandoffService');

const plain = text =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();

const clarification = reply => ({ clarification: reply });

const VOCAB = {
  occasion: [
    'sinh nhật',
    'khai trương',
    'kỷ niệm',
    'tốt nghiệp',
    'cưới'
  ],

  color: [
    'hồng',
    'đỏ',
    'trắng',
    'vàng',
    'tím',
    'xanh'
  ],

  recipient: [
    'mẹ',
    'bạn gái',
    'người yêu',
    'vợ',
    'chồng',
    'bố',
    'thầy cô'
  ],

  style: [
    'sang trọng',
    'đơn giản',
    'nhẹ nhàng',
    'pastel',
    'lãng mạn',
    'nổi bật'
  ],

  flower: [
    'tulip',
    'hướng dương',
    'cẩm tú cầu',
    'hoa hồng',
    'hoa lan',
    'hoa ly'
  ]
};

const PRODUCT_REFERENCE_WORDS =
  /(?:mau|loai|san pham)/;

const ALTERNATIVE_PATTERN =
  /\b(?:loai khac|mau khac|san pham khac)\b/;

const CHEAPER_PATTERN =
  /\b(?:re hon|gia thap hon|tiet kiem hon)\b/;

const REFERENCE_TOKEN =
  '(\\d+|dau tien|cuoi|mot|hai|ba|bon)';

function hasTextValue(object = {}) {
  return Object.values(object).some(
    value =>
      value !== undefined &&
      value !== null &&
      value !== ''
  );
}

function referenceIndex(value, idsLength) {
  if (value === 'cuoi') {
    return idsLength - 1;
  }

  const words = {
    'dau tien': 0,
    mot: 0,
    hai: 1,
    ba: 2,
    bon: 3
  };

  if (
    Object.prototype.hasOwnProperty.call(
      words,
      value
    )
  ) {
    return words[value];
  }

  const parsed = Number(value);

  return Number.isInteger(parsed)
    ? parsed - 1
    : -1;
}

function comparisonFocus(text) {
  if (
    /\b(?:mau nao|cai nao|loai nao|san pham nao).*(?:re hon|re nhat|gia thap hon|gia thap nhat)\b|\bso sanh gia\b/.test(text)
  ) {
    return 'price';
  }

  if (
    /\b(?:mau nao|cai nao|loai nao|san pham nao).*(?:con nhieu hon|con nhieu nhat|ton kho nhieu hon|ton kho nhieu nhat|con hang nhieu hon)\b|\bso sanh ton kho\b/.test(text)
  ) {
    return 'stock';
  }

  if (
    /\b(?:mau nao|cai nao|loai nao|san pham nao).*(?:dep hon|hop hon|phu hop hon)\b|\bnen chon (?:mau|loai|san pham) nao\b/.test(text)
  ) {
    return 'subjective';
  }

  return 'general';
}

function resolveComparison(text, ids) {
  const explicitPatterns = [
    new RegExp(
      `\\bso sanh\\s+(?:(?:mau|loai|san pham)\\s*)?(?:thu\\s*)?${REFERENCE_TOKEN}\\s*(?:voi|va)\\s*(?:(?:mau|loai|san pham)\\s*)?(?:thu\\s*)?${REFERENCE_TOKEN}\\b`
    ),

    new RegExp(
      `\\b(?:mau|loai|san pham)\\s*(?:thu\\s*)?${REFERENCE_TOKEN}\\s*(?:voi|va)\\s*(?:(?:mau|loai|san pham)\\s*)?(?:thu\\s*)?${REFERENCE_TOKEN}\\b`
    )
  ];

  let explicit = null;

  for (const pattern of explicitPatterns) {
    explicit = pattern.exec(text);

    if (explicit) {
      break;
    }
  }

  if (explicit) {
    const firstIndex =
      referenceIndex(
        explicit[1],
        ids.length
      );

    const secondIndex =
      referenceIndex(
        explicit[2],
        ids.length
      );

    if (
      firstIndex < 0 ||
      secondIndex < 0 ||
      firstIndex >= ids.length ||
      secondIndex >= ids.length
    ) {
      return clarification(
        'Mình chưa xác định được đủ hai mẫu bạn muốn so sánh. Vui lòng chọn theo số thứ tự trong danh sách vừa được gợi ý.'
      );
    }

    if (firstIndex === secondIndex) {
      return clarification(
        'Bạn đang chọn cùng một mẫu hai lần. Vui lòng chọn hai mẫu khác nhau để mình so sánh.'
      );
    }

    return {
      compareProductIds: [
        ids[firstIndex],
        ids[secondIndex]
      ],

      comparisonFocus:
        comparisonFocus(text)
    };
  }

  const asksComparison =
    /\b(?:so sanh|khac nhau gi)\b/.test(text);

  if (asksComparison) {
    if (ids.length < 2) {
      return clarification(
        'Mình cần ít nhất hai mẫu trong danh sách để so sánh. Bạn hãy yêu cầu gợi ý sản phẩm trước nha.'
      );
    }

    if (ids.length > 2) {
      return clarification(
        'Bạn muốn so sánh mẫu nào với mẫu nào? Ví dụ: "So sánh mẫu 1 với mẫu 2".'
      );
    }

    return {
      compareProductIds:
        ids.slice(0, 2),

      comparisonFocus:
        comparisonFocus(text)
    };
  }

  const focus =
    comparisonFocus(text);

  if (
    focus !== 'general' &&
    ids.length >= 2
  ) {
    return {
      compareProductIds:
        ids.slice(
          0,
          Math.min(ids.length, 4)
        ),

      comparisonFocus:
        focus
    };
  }

  return null;
}

function detectVocab(text, constraints) {
  let detected = false;

  for (const [key, values] of Object.entries(VOCAB)) {
    const match = values.find(value => {
      const normalized = plain(value)
        .replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        );

      return new RegExp(
        `(?:^|\\s)${normalized}(?:\\s|[?!. ,]|$)`
      ).test(text);
    });

    if (!match) {
      continue;
    }

    if (
      key === 'color' &&
      !/\b(?:mau|tone)\b/.test(text)
    ) {
      continue;
    }

    constraints[key] = match;
    detected = true;

    if (key === 'flower') {
      delete constraints.keyword;
    }
  }

  return detected;
}

function detectBudget(text) {
  const budgetPattern =
    /(?:tu|duoi|toi da|khong qua|khoang|ngan sach|it nhat)\s+\d+(?:[.,]\d+)?\s*(?:trieu|tr|nghin|ngan|k|dong|vnd)(?:\s+den\s+\d+(?:[.,]\d+)?\s*(?:trieu|tr|nghin|ngan|k|dong|vnd))?\b/;

  const match =
    text.match(budgetPattern);

  if (match) {
    return match[0];
  }

  const bareAmount = text.match(
    /\b\d+(?:[.,]\d+)?\s*(?:trieu|tr|nghin|ngan|k|dong|vnd)\b/
  );

  return bareAmount
    ? `khoang ${bareAmount[0]}`
    : null;
}

function recommendationSignal(text) {
  return /\b(?:tang|sinh nhat|khai truong|ky niem|tot nghiep|cuoi|nguoi yeu|ban gai|me|bo|vo|chong|phong cach|tone|nhe nhang|sang trong|don gian|pastel|lang man|noi bat|chon gi|goi y|tu van)\b/
    .test(text);
}

function resolve(message, context) {
  const text =
    plain(message.trim());

  const ids =
    Array.isArray(context.productIds)
      ? context.productIds
      : [];

  // =========================
  // Product comparison
  // =========================

  const comparison =
    resolveComparison(
      text,
      ids
    );

  if (comparison) {
    return comparison;
  }

  // =========================
  // Product reference
  // =========================

  const numbered = text.match(
    /(?:mau|loai|san pham)\s*(?:thu\s*)?(\d+|dau tien|cuoi|mot|hai|ba|bon)\b/
  );

  if (
    numbered ||
    /\b(?:cai do|mau vua roi)\b/.test(text)
  ) {
    let id;

    if (numbered) {
      const value =
        numbered[1];

      const index =
        referenceIndex(
          value,
          ids.length
        );

      id = ids[index];
    } else {
      id =
        context.selectedId ||
        (
          ids.length === 1
            ? ids[0]
            : null
        );
    }

    return id
      ? { productId: id }
      : clarification(
          'Bạn đang nói tới mẫu nào? Vui lòng nêu số thứ tự trong danh sách vừa được gợi ý.'
        );
  }

  // =========================
  // Existing product search
  // =========================

  const initial =
    parseProductSearch(message);

  if (initial?.clarification) {
    return initial;
  }

  // =========================
  // Recommendation context
  // =========================

  const previousConstraints = {
    ...(context.constraints || {})
  };

  const constraints = {
    ...previousConstraints
  };

  const detectedVocab =
    detectVocab(
      text,
      constraints
    );

  const budgetText =
    detectBudget(text);

  const cheaper =
    CHEAPER_PATTERN.test(text);

  const alternative =
    ALTERNATIVE_PATTERN.test(text);

  const priorContext =
    hasTextValue(previousConstraints) ||
    ids.length > 0;

  const followup =
    PRODUCT_REFERENCE_WORDS.test(text) ||
    cheaper ||
    alternative ||
    /\b(?:con hang|khoang|tone|phong cach)\b/.test(text);

  const looksLikeRecommendation =
    Boolean(
      initial ||
      detectedVocab ||
      budgetText ||
      recommendationSignal(text) ||
      (priorContext && followup)
    );

  if (!looksLikeRecommendation) {
    return null;
  }

  // =========================
  // Input guard
  // =========================

  if (/[$<>{}\[\]\\]/.test(text)) {
    return clarification(
      'Vui lòng mô tả tiêu chí tìm hoa bằng văn bản thông thường.'
    );
  }

  // =========================
  // Explicit budget
  // =========================

  if (budgetText) {
    const parsed =
      parseProductSearch(
        `Tìm hoa ${budgetText}`
      );

    if (!parsed?.params) {
      return clarification(
        'Vui lòng nêu lại khoảng ngân sách hợp lệ.'
      );
    }

    delete constraints.minPrice;
    delete constraints.maxPrice;

    for (const key of [
      'minPrice',
      'maxPrice'
    ]) {
      if (
        parsed.params[key] !==
        undefined
      ) {
        constraints[key] =
          parsed.params[key];
      }
    }
  }

  // =========================
  // "Rẻ hơn chút"
  // =========================

  if (
    cheaper &&
    !Number.isFinite(
      constraints.maxPrice
    )
  ) {
    return clarification(
      'Bạn muốn tìm mẫu rẻ hơn trong khoảng ngân sách tối đa bao nhiêu?'
    );
  }

  // =========================
  // Keyword
  // =========================

  if (
    initial?.params?.keyword &&
    !detectedVocab
  ) {
    constraints.keyword =
      safeMessage(
        initial.params.keyword
      ).slice(0, 200);

    delete constraints.flower;
  }

  // =========================
  // Search terms
  // =========================

  const searchableTerms = [
    constraints.keyword,
    constraints.flower,
    constraints.color,
    constraints.occasion,
    constraints.style
  ].filter(Boolean);

  const uniqueTerms = [
    ...new Set(searchableTerms)
  ];

  const params = {
    inStockOnly: true,
    limit: 4
  };

  // =========================
  // Budget params
  // =========================

  for (const key of [
    'minPrice',
    'maxPrice'
  ]) {
    if (
      constraints[key] !==
      undefined
    ) {
      params[key] =
        constraints[key];
    }
  }

  let cheaperReferenceMaxPrice =
    null;

  if (cheaper) {
    cheaperReferenceMaxPrice =
      constraints.maxPrice;

    params.maxPrice =
      Math.max(
        0,
        Math.floor(
          constraints.maxPrice
        ) - 1
      );

    if (
      params.minPrice !== undefined &&
      params.minPrice >
        params.maxPrice
    ) {
      delete params.minPrice;
    }
  }

  // =========================
  // Exclude displayed products
  // =========================

  if (
    (alternative || cheaper) &&
    ids.length
  ) {
    params.excludeIds =
      ids.slice(0, 4);
  }

  // =========================
  // Keyword params
  // =========================

  if (uniqueTerms.length === 1) {
    params.keyword =
      uniqueTerms[0];
  } else if (
    uniqueTerms.length > 1
  ) {
    params.keywords =
      uniqueTerms.slice(0, 6);
  }

  // =========================
  // Validate useful constraints
  // =========================

  const hasAnySearchConstraint =
    Boolean(
      params.keyword ||
      params.keywords ||
      params.minPrice !== undefined ||
      params.maxPrice !== undefined
    );

  if (
    !hasAnySearchConstraint &&
    !priorContext
  ) {
    return clarification(
      'Bạn muốn tìm hoa cho dịp nào hoặc trong khoảng ngân sách bao nhiêu?'
    );
  }

  return {
    params,
    constraints,
    cheaper,
    alternative,
    cheaperReferenceMaxPrice,

    recommendation: Boolean(
      constraints.occasion ||
      constraints.recipient ||
      constraints.style ||
      constraints.color
    )
  };
}

module.exports = {
  resolve
};