/**
 * AK's MEN STYLE — Rule-Based Outfit Recommendation Engine (Phase 8 Refined)
 * 
 * Rules:
 * 1. ONLY Tops (Shirts, T-Shirts, Hoodies, Jackets; IDs 1-20, 31-50) and
 *    Bottoms (Pants & Trousers; IDs 21-30) are eligible for "COMPLETE THE LOOK".
 * 2. Accessories (Shoes 51-60, Watches 61-70, Caps 71-80, Belts 81-90, Sunglasses 91-100)
 *    are NEVER eligible and return { available: false }.
 * 3. Combinations:
 *    - For Top: Top (Anchor) + Bottom + Shoes + Watch
 *    - For Bottom: Bottom (Anchor) + Top + Shoes + Watch
 * 4. Deterministic Unique Allocation:
 *    - Combination Signature: anchorId-bottomId-shoeId-watchId (for Tops)
 *                             anchorId-topId-shoeId-watchId (for Bottoms)
 *    - Guarantees 0 duplicate signatures across all anchor products.
 * 5. Out-of-Stock Rule:
 *    - Never recommend items with stock = 0 or status = 'SOLD_OUT'.
 *    - If an existing recommendation has an OOS item, dynamically re-allocates a new unique combo.
 * 6. Persistence:
 *    - Reuses `outfit_recommendations` table to store stable, persisted allocations.
 */

// 1. Style Archetype Definitions
const ARCHETYPES = {
  FORMAL: {
    name: 'Formal / Business',
    topTypes: ['Oxford Shirt', 'Business Shirt', 'Dress Shirt'],
    bottomTypes: ['Formal Trousers', 'Slim-Fit Trousers', 'Pleated Trousers', 'Tapered Trousers'],
    shoeTypes: ['Oxford Shoes', 'Derby Shoes', 'Penny Loafers'],
    watchTypes: ['Dress Watch', 'Minimalist Watch', 'Slim Watch', 'Steel Watch'],
    reasons: {
      bottom: (anchor, item) => `${item.name} provides a crisp, tailored foundation matching the formal cut of ${anchor.name}.`,
      shoes: (anchor, item) => `Polished ${item.name} grounds the formal ensemble with executive sophistication.`,
      watch: (anchor, item) => `The ${item.name} adds a refined, understated luxury accent appropriate for business settings.`,
      top: (anchor, item) => `${item.name} delivers a crisp, tailored top to balance these formal trousers.`
    }
  },
  SMART_CASUAL: {
    name: 'Smart Casual',
    topTypes: ['Casual Shirt', 'Cuban Collar Shirt', 'Checked Shirt', 'Linen Shirt', 'Overshirt', 'Polo Tee', 'Plain T-Shirt', 'Henley T-Shirt', 'V-Neck T-Shirt'],
    bottomTypes: ['Chinos', 'Casual Pants', 'Linen Pants', 'Tapered Trousers'],
    shoeTypes: ['Penny Loafers', 'Driving Shoes', 'Chelsea Boots', 'Sneakers', 'Espadrilles'],
    watchTypes: ['Chronograph', 'Vintage Watch', 'Minimalist Watch', 'Field Watch'],
    reasons: {
      bottom: (anchor, item) => `${item.name} complements the smart-casual profile with versatile, clean tailoring.`,
      shoes: (anchor, item) => `${item.name} harmonizes style and everyday comfort seamlessly.`,
      watch: (anchor, item) => `${item.name} adds timeless craftsmanship and functional prestige to the outfit.`,
      top: (anchor, item) => `${item.name} pairs effortlessly with these trousers for elevated everyday wear.`
    }
  },
  STREETWEAR: {
    name: 'Streetwear / Athleisure',
    topTypes: [
      'Graphic T-Shirt', 'Oversized T-Shirt', 'Long Sleeve T-Shirt',
      'Pullover Hoodie', 'Printed Hoodie', 'Oversized Hoodie', 'Colour Block Hoodie', 'Zip-Up Hoodie', 'Washed Hoodie',
      'Denim Jacket', 'Bomber Jacket', 'Quilted Puffer Jacket', 'Varsity Jacket', 'Biker Jacket', 'Windbreaker', 'Field Jacket', 'Harrington Jacket', 'Coach Jacket', 'Workwear Jacket'
    ],
    bottomTypes: ['Jogger Pants', 'Cargo Pants', 'Wide-Leg Trousers'],
    shoeTypes: ['Sneakers', 'Skate Shoes', 'High-Tops', 'Trainers'],
    watchTypes: ['Digital Watch', 'Pilot Watch', 'Chronograph', 'Steel Watch'],
    reasons: {
      bottom: (anchor, item) => `${item.name} matches the relaxed, contemporary streetwear aesthetic of ${anchor.name}.`,
      shoes: (anchor, item) => `${item.name} anchors the relaxed silhouette with street-smart appeal.`,
      watch: (anchor, item) => `The bold, rugged styling of ${item.name} complements the modern urban look.`,
      top: (anchor, item) => `${item.name} layers naturally over these casual bottoms for an effortless contemporary look.`
    }
  }
};

// 2. Color Palette & Harmony Rules
const COLOR_FAMILIES = {
  WHITE: { match: /white|cream/i, compatible: ['NAVY', 'GREY', 'BLACK', 'BEIGE', 'OLIVE'] },
  BLACK: { match: /black/i, compatible: ['WHITE', 'GREY', 'BEIGE', 'BLACK', 'OLIVE'] },
  NAVY: { match: /navy|slate blue/i, compatible: ['WHITE', 'GREY', 'BEIGE', 'BLACK', 'BROWN'] },
  GREY: { match: /grey|charcoal|ash|gunmetal|steel/i, compatible: ['WHITE', 'BLACK', 'NAVY', 'BEIGE'] },
  BEIGE: { match: /beige|khaki|taupe|sand/i, compatible: ['NAVY', 'WHITE', 'BLACK', 'GREY', 'BROWN', 'OLIVE'] },
  BROWN: { match: /brown|mocha|tan|tobacco/i, compatible: ['WHITE', 'NAVY', 'BEIGE', 'GREY'] },
  OLIVE: { match: /olive/i, compatible: ['BLACK', 'WHITE', 'BEIGE', 'GREY'] }
};

function getColorFamily(colorStr) {
  if (!colorStr) return 'GREY';
  for (const [family, conf] of Object.entries(COLOR_FAMILIES)) {
    if (conf.match.test(colorStr)) return family;
  }
  return 'GREY';
}

function areColorsCompatible(c1, c2) {
  const f1 = getColorFamily(c1);
  const f2 = getColorFamily(c2);
  if (f1 === f2 && f1 !== 'OLIVE') return true;
  const comp = COLOR_FAMILIES[f1]?.compatible || ['WHITE', 'BLACK', 'GREY'];
  return comp.includes(f2);
}

function getProductArchetype(p) {
  for (const [key, conf] of Object.entries(ARCHETYPES)) {
    if (
      conf.topTypes.includes(p.cloth_type) ||
      conf.bottomTypes.includes(p.cloth_type) ||
      conf.shoeTypes.includes(p.cloth_type) ||
      conf.watchTypes.includes(p.cloth_type)
    ) {
      return key;
    }
  }
  if (p.category === 'Shirts') return 'FORMAL';
  if (p.category === 'Hoodies' || p.category === 'Jackets') return 'STREETWEAR';
  return 'SMART_CASUAL';
}

/**
 * Checks if a product is eligible for "COMPLETE THE LOOK" recommendations.
 * Eligible: Tops (1-20, 31-50) and Bottoms (21-30).
 * Ineligible: Shoes, Watches, Caps, Belts, Sunglasses (51-100).
 */
export function isEligibleForRecommendation(product) {
  if (!product) return false;
  if (product.vton_supported !== 1) return false;
  return product.vton_garment_category === 'tops' || product.vton_garment_category === 'bottoms';
}

/**
 * Generates or retrieves a unique, rule-based outfit recommendation for an anchor product.
 * @param {number|string} productId 
 * @param {import('better-sqlite3').Database} db 
 * @returns {object}
 */
export function getRecommendationsForProduct(productId, db) {
  const anchor = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(productId));
  if (!anchor) return null;

  // 1. Eligibility Check: ONLY Tops and Bottoms
  if (!isEligibleForRecommendation(anchor)) {
    return {
      available: false,
      reason: 'Recommendations are only available for tops and bottoms'
    };
  }

  const isTop = anchor.vton_garment_category === 'tops';

  // 2. Check if a valid, persisted recommendation already exists in outfit_recommendations
  const existingRows = db.prepare(`
    SELECT r.*, p.name AS product_name, p.image AS product_image, p.price, p.original_price, p.discount_percent, p.stock, p.status, p.category, p.cloth_type, p.color, p.brand
    FROM outfit_recommendations r
    JOIN products p ON r.recommended_product_id = p.id
    WHERE r.base_product_id = ?
    ORDER BY r.id ASC
  `).all(anchor.id);

  // If existing recommendation has exactly 3 items and ALL are in stock, return persisted recommendation
  if (existingRows.length === 3 && existingRows.every(row => row.stock > 0 && row.status === 'IN_STOCK')) {
    return {
      available: true,
      signature: existingRows[0].combination_signature,
      anchorProduct: {
        id: anchor.id,
        name: anchor.name,
        category: anchor.category,
        cloth_type: anchor.cloth_type,
        color: anchor.color,
        brand: anchor.brand,
        price: anchor.price,
        original_price: anchor.original_price,
        discount_percent: anchor.discount_percent,
        stock: anchor.stock,
        status: anchor.status,
        image: anchor.image,
        garment_image: anchor.garment_image,
        vton_supported: anchor.vton_supported
      },
      recommendations: existingRows.map(row => ({
        slot: row.slot_type,
        product: {
          id: row.recommended_product_id,
          name: row.product_name,
          category: row.category,
          cloth_type: row.cloth_type,
          color: row.color,
          brand: row.brand,
          price: row.price,
          original_price: row.original_price,
          discount_percent: row.discount_percent,
          stock: row.stock,
          status: row.status,
          image: row.product_image
        },
        reason: row.reason
      }))
    };
  }

  // 3. Stale or Missing: Allocate a New Unique Outfit Combination
  // Remove stale rows for this anchor
  db.prepare('DELETE FROM outfit_recommendations WHERE base_product_id = ?').run(anchor.id);

  // Retrieve existing signatures and trios allocated to other anchors
  const otherAllocations = db.prepare(`
    SELECT base_product_id, recommended_product_id, slot_type, combination_signature
    FROM outfit_recommendations
    WHERE base_product_id != ?
    ORDER BY base_product_id ASC, id ASC
  `).all(anchor.id);

  const usedSignatures = new Set(otherAllocations.map(r => r.combination_signature).filter(Boolean));
  
  // Group other allocations by base_product_id to extract used trios
  const usedTrios = new Set();
  const byBase = {};
  for (const r of otherAllocations) {
    if (!byBase[r.base_product_id]) byBase[r.base_product_id] = [];
    byBase[r.base_product_id].push(r.recommended_product_id);
  }
  for (const items of Object.values(byBase)) {
    if (items.length === 3) {
      usedTrios.add(items.join('-'));
    }
  }

  // Fetch all in-stock candidate products
  const allInStock = db.prepare(`
    SELECT * FROM products
    WHERE stock > 0 AND status = 'IN_STOCK' AND id != ?
  `).all(anchor.id);

  const archKey = getProductArchetype(anchor);
  const archetype = ARCHETYPES[archKey];

  let slot1Name, slot1Candidates, slot1Preferred, slot1Reason;
  let slot2Name = 'Shoes', slot2Candidates, slot2Preferred = archetype.shoeTypes, slot2Reason = archetype.reasons.shoes;
  let slot3Name = 'Watch', slot3Candidates, slot3Preferred = archetype.watchTypes, slot3Reason = archetype.reasons.watch;

  slot2Candidates = allInStock.filter(p => p.category === 'Shoes');
  slot3Candidates = allInStock.filter(p => p.category === 'Watches');

  if (isTop) {
    slot1Name = 'Bottom';
    slot1Candidates = allInStock.filter(p => p.category === 'Pants & Trousers');
    slot1Preferred = archetype.bottomTypes;
    slot1Reason = archetype.reasons.bottom;
  } else {
    slot1Name = 'Top';
    slot1Candidates = allInStock.filter(p => ['Shirts', 'T-Shirts', 'Hoodies', 'Jackets'].includes(p.category));
    slot1Preferred = archetype.topTypes;
    slot1Reason = archetype.reasons.top;
  }

  // Score candidate items based on style match and color harmony
  const scoreItem = (item, preferredTypes) => {
    let score = 0;
    if (preferredTypes && preferredTypes.includes(item.cloth_type)) score += 10;
    if (areColorsCompatible(anchor.color, item.color)) score += 8;
    else {
      const fam = getColorFamily(item.color);
      if (['WHITE', 'BLACK', 'GREY'].includes(fam)) score += 4;
    }
    if (item.discount_percent > 0) score += 1;
    return score;
  };

  const scored1 = slot1Candidates.map(p => ({ p, s: scoreItem(p, slot1Preferred) })).sort((a, b) => b.s - a.s || a.p.id - b.p.id);
  const scored2 = slot2Candidates.map(p => ({ p, s: scoreItem(p, slot2Preferred) })).sort((a, b) => b.s - a.s || a.p.id - b.p.id);
  const scored3 = slot3Candidates.map(p => ({ p, s: scoreItem(p, slot3Preferred) })).sort((a, b) => b.s - a.s || a.p.id - b.p.id);

  // Find first unused unique combination
  let chosen = null;
  let chosenSig = null;
  let chosenTrio = null;

  comboSearch:
  for (const s1 of scored1) {
    for (const s2 of scored2) {
      for (const s3 of scored3) {
        // Conceptually: anchorId-bottomId-shoeId-watchId or anchorId-topId-shoeId-watchId
        const sig = `${anchor.id}-${s1.p.id}-${s2.p.id}-${s3.p.id}`;
        const trio = `${s1.p.id}-${s2.p.id}-${s3.p.id}`;

        if (!usedSignatures.has(sig) && !usedTrios.has(trio)) {
          chosen = [s1.p, s2.p, s3.p];
          chosenSig = sig;
          chosenTrio = trio;
          break comboSearch;
        }
      }
    }
  }

  // Fallback: If all trios were somehow used, pick combination with unique signature
  if (!chosen) {
    fallbackSearch:
    for (const s1 of scored1) {
      for (const s2 of scored2) {
        for (const s3 of scored3) {
          const sig = `${anchor.id}-${s1.p.id}-${s2.p.id}-${s3.p.id}`;
          if (!usedSignatures.has(sig)) {
            chosen = [s1.p, s2.p, s3.p];
            chosenSig = sig;
            chosenTrio = `${s1.p.id}-${s2.p.id}-${s3.p.id}`;
            break fallbackSearch;
          }
        }
      }
    }
  }

  if (!chosen) {
    return { available: false, reason: 'No unique compatible outfit combination could be generated.' };
  }

  const [item1, item2, item3] = chosen;
  const reason1 = slot1Reason(anchor, item1);
  const reason2 = slot2Reason(anchor, item2);
  const reason3 = slot3Reason(anchor, item3);

  // Persist the unique combination atomically to outfit_recommendations
  const insertStmt = db.prepare(`
    INSERT INTO outfit_recommendations (base_product_id, recommended_product_id, slot_type, reason, combination_signature)
    VALUES (?, ?, ?, ?, ?)
  `);

  const persistTransaction = db.transaction(() => {
    insertStmt.run(anchor.id, item1.id, slot1Name, reason1, chosenSig);
    insertStmt.run(anchor.id, item2.id, slot2Name, reason2, chosenSig);
    insertStmt.run(anchor.id, item3.id, slot3Name, reason3, chosenSig);
  });

  persistTransaction();

  return {
    available: true,
    signature: chosenSig,
    anchorProduct: {
      id: anchor.id,
      name: anchor.name,
      category: anchor.category,
      cloth_type: anchor.cloth_type,
      color: anchor.color,
      brand: anchor.brand,
      price: anchor.price,
      original_price: anchor.original_price,
      discount_percent: anchor.discount_percent,
      stock: anchor.stock,
      status: anchor.status,
      image: anchor.image,
      garment_image: anchor.garment_image,
      vton_supported: anchor.vton_supported
    },
    recommendations: [
      {
        slot: slot1Name,
        product: {
          id: item1.id,
          name: item1.name,
          category: item1.category,
          cloth_type: item1.cloth_type,
          color: item1.color,
          brand: item1.brand,
          price: item1.price,
          original_price: item1.original_price,
          discount_percent: item1.discount_percent,
          stock: item1.stock,
          status: item1.status,
          image: item1.image
        },
        reason: reason1
      },
      {
        slot: slot2Name,
        product: {
          id: item2.id,
          name: item2.name,
          category: item2.category,
          cloth_type: item2.cloth_type,
          color: item2.color,
          brand: item2.brand,
          price: item2.price,
          original_price: item2.original_price,
          discount_percent: item2.discount_percent,
          stock: item2.stock,
          status: item2.status,
          image: item2.image
        },
        reason: reason2
      },
      {
        slot: slot3Name,
        product: {
          id: item3.id,
          name: item3.name,
          category: item3.category,
          cloth_type: item3.cloth_type,
          color: item3.color,
          brand: item3.brand,
          price: item3.price,
          original_price: item3.original_price,
          discount_percent: item3.discount_percent,
          stock: item3.stock,
          status: item3.status,
          image: item3.image
        },
        reason: reason3
      }
    ]
  };
}

/**
 * Initializes and pre-allocates unique recommendations for all 50 VTON tops & bottoms.
 * Guarantees zero duplicate signatures across the entire catalog.
 */
export function initializeAllRecommendations(db) {
  const anchors = db.prepare(`
    SELECT id, vton_garment_category FROM products
    WHERE vton_supported = 1
    ORDER BY id ASC
  `).all();

  for (const anchor of anchors) {
    getRecommendationsForProduct(anchor.id, db);
  }
}
