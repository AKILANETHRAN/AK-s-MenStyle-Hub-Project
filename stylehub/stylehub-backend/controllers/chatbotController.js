import db from '../config/database.js';

/**
 * Deterministic / rule-based fashion assistant for AK'S MEN STYLE
 * POST /api/chatbot/message
 * Body: { message: string }
 */
export function handleChatMessage(req, res) {
  try {
    const rawMessage = (req.body.message || '').trim();
    if (!rawMessage) {
      return res.status(400).json({ status: 'error', message: 'Message cannot be empty.' });
    }

    const lower = rawMessage.toLowerCase();

    // 1. Virtual Try-On Queries
    if (
      lower.includes('vton') ||
      lower.includes('virtual try') ||
      lower.includes('try on') ||
      lower.includes('try clothes') ||
      lower.includes('how does virtual')
    ) {
      const vtonTopsCount = db.prepare("SELECT COUNT(*) AS count FROM products WHERE vton_supported = 1 AND vton_garment_category = 'tops'").get().count;
      const vtonBottomsCount = db.prepare("SELECT COUNT(*) AS count FROM products WHERE vton_supported = 1 AND vton_garment_category = 'bottoms'").get().count;

      return res.status(200).json({
        status: 'success',
        reply: `Our AI Virtual Try-On studio runs locally using the FASHN v1.5 diffusion pipeline (CUDA GPU accelerated). Upload your portrait photo, pick from ${vtonTopsCount} studio Tops (IDs 1–20, 31–50) or ${vtonBottomsCount} studio Bottoms (IDs 21–30), and generate a realistic personalized fitting without any cloud uploads.`,
        action: {
          type: 'NAVIGATE',
          label: 'Launch Virtual Fitting Studio',
          path: '/virtual-try-on'
        },
        suggestions: ['Show me shirts', 'Suggest pants for white shirt', 'How do I share a look?']
      });
    }

    // 2. Outfit Styling & Recommendations Queries
    if (
      lower.includes('suggest') ||
      lower.includes('recommend') ||
      lower.includes('complete the look') ||
      lower.includes('what goes with') ||
      lower.includes('match') ||
      lower.includes('look')
    ) {
      // Find matching base items if mentioned
      let sampleProduct = null;
      if (lower.includes('white') || lower.includes('shirt')) {
        sampleProduct = db.prepare("SELECT * FROM products WHERE (category = 'Shirts' OR cloth_type = 'Top') AND stock > 0 ORDER BY id ASC LIMIT 1").get();
      } else if (lower.includes('pant') || lower.includes('trouser')) {
        sampleProduct = db.prepare("SELECT * FROM products WHERE category = 'Pants' AND stock > 0 ORDER BY id ASC LIMIT 1").get();
      } else {
        sampleProduct = db.prepare("SELECT * FROM products WHERE vton_supported = 1 AND stock > 0 ORDER BY id ASC LIMIT 1").get();
      }

      let complementaryProducts = [];
      if (sampleProduct) {
        complementaryProducts = db.prepare(`
          SELECT p.id, p.name, p.brand, p.category, p.price, p.discount_percent, p.image, rec.slot_type, rec.reason
          FROM outfit_recommendations rec
          JOIN products p ON rec.recommended_product_id = p.id
          WHERE rec.base_product_id = ? AND p.stock > 0
          LIMIT 3
        `).all(sampleProduct.id);
      }

      return res.status(200).json({
        status: 'success',
        reply: sampleProduct
          ? `For a sharp, curated look starting with "${sampleProduct.name}" (₹${sampleProduct.price}): We recommend pairing with complementary tailored trousers, executive footwear, and a luxury timepiece.`
          : 'Our unique rule-based Complete-the-Look engine pairs any top or bottom with 3 deterministic complementary garments and accessories.',
        products: complementaryProducts.length > 0 ? complementaryProducts : undefined,
        action: sampleProduct ? {
          type: 'NAVIGATE',
          label: `View ${sampleProduct.name}`,
          path: `/products/${sampleProduct.id}`
        } : {
          type: 'NAVIGATE',
          label: 'Browse Collection',
          path: '/products'
        },
        suggestions: ['Show me shirts', 'Show me watches', 'How do I purchase?']
      });
    }

    // 3. Friends & Look Sharing Queries
    if (
      lower.includes('friend') ||
      lower.includes('share') ||
      lower.includes('reaction') ||
      lower.includes('feedback')
    ) {
      return res.status(200).json({
        status: 'success',
        reply: 'Style with Friends allows private social styling! Connect with friends via @username in the Friends hub. Once connected, open any product or Complete-the-Look ensemble, click "SHARE WITH FRIEND", and they can send real-time reactions (👍 LIKE, ❤️ LOVE, 🔥 FIRE) and feedback comments directly to your notifications.',
        action: {
          type: 'NAVIGATE',
          label: 'Open Friends Hub',
          path: '/friends'
        },
        suggestions: ['Show me shirts', 'What can I try with VTON?', 'How do I purchase?']
      });
    }

    // 4. Purchase Flow Queries
    if (
      lower.includes('purchase') ||
      lower.includes('buy') ||
      lower.includes('order') ||
      lower.includes('checkout') ||
      lower.includes('pay')
    ) {
      return res.status(200).json({
        status: 'success',
        reply: 'You can purchase directly using our streamlined direct checkout: 1) Click "BUY NOW" on any product for single item purchase, or 2) Click "BUY COMPLETE LOOK" to purchase a curated 4-piece ensemble atomically. Your delivery address is saved to your profile for seamless order placement.',
        action: {
          type: 'NAVIGATE',
          label: 'View Order History',
          path: '/purchases'
        },
        suggestions: ['Show me shirts', 'What products are in stock?', 'How does virtual try-on work?']
      });
    }

    // 5. Stock & Availability Queries
    if (
      lower.includes('in stock') ||
      lower.includes('stock') ||
      lower.includes('available')
    ) {
      const inStockCount = db.prepare("SELECT COUNT(*) AS count FROM products WHERE stock > 0 AND status = 'IN_STOCK'").get().count;
      const featured = db.prepare("SELECT id, name, brand, category, price, discount_percent, stock, image FROM products WHERE stock > 0 ORDER BY stock DESC LIMIT 3").all();

      return res.status(200).json({
        status: 'success',
        reply: `Currently, ${inStockCount} garments and accessories are in stock with active inventory (strictly between 10–20 units normalized). All purchases decrement inventory atomically.`,
        products: featured,
        action: {
          type: 'NAVIGATE',
          label: 'Browse In-Stock Products',
          path: '/products?inStock=true'
        },
        suggestions: ['Show me shirts', 'Show me watches', 'Suggest pants for white shirt']
      });
    }

    // 6. Category Queries (shirts, pants, jackets, t-shirts, shoes, watches, accessories)
    const categoryKeywords = [
      { key: 'shirt', category: 'Shirts' },
      { key: 't-shirt', category: 'T-Shirts' },
      { key: 'tee', category: 'T-Shirts' },
      { key: 'pant', category: 'Pants' },
      { key: 'trouser', category: 'Pants' },
      { key: 'chino', category: 'Pants' },
      { key: 'jacket', category: 'Jackets' },
      { key: 'hoodie', category: 'Hoodies' },
      { key: 'shoe', category: 'Shoes' },
      { key: 'watch', category: 'Watches' },
      { key: 'cap', category: 'Caps' },
      { key: 'belt', category: 'Belts' },
      { key: 'sunglass', category: 'Sunglasses' },
      { key: 'accessori', category: 'Accessories' }
    ];

    const matchedCat = categoryKeywords.find(c => lower.includes(c.key));
    if (matchedCat) {
      const prods = db.prepare(`
        SELECT id, name, brand, category, price, discount_percent, stock, image
        FROM products
        WHERE (LOWER(category) = LOWER(?) OR LOWER(cloth_type) LIKE LOWER(?)) AND stock > 0
        ORDER BY id ASC
        LIMIT 4
      `).all(matchedCat.category, `%${matchedCat.key}%`);

      if (prods.length > 0) {
        return res.status(200).json({
          status: 'success',
          reply: `Here are premium ${matchedCat.category} from our current catalog (prices strictly ₹400–₹700 with verified discounts):`,
          products: prods,
          action: {
            type: 'NAVIGATE',
            label: `View All ${matchedCat.category}`,
            path: `/products?category=${encodeURIComponent(matchedCat.category)}`
          },
          suggestions: ['Suggest pants for white shirt', 'What can I try with VTON?', 'How do I purchase?']
        });
      }
    }

    // 7. Default Helpful Response with realistic options
    return res.status(200).json({
      status: 'success',
      reply: "Welcome to AK'S MEN STYLE Assistant. I can help you discover luxury menswear, find matching outfit combinations, guide you through AI Virtual Try-On, or explain friend sharing and direct checkout.",
      suggestions: [
        'Show me shirts',
        'Suggest pants for white shirt',
        'What can I try with VTON?',
        'Show me watches',
        'How do I share a look with a friend?',
        'How do I purchase?',
        'What products are in stock?'
      ]
    });
  } catch (err) {
    console.error('handleChatMessage error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to process assistant message.' });
  }
}
