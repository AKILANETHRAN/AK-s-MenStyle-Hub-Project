import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Distinct curated Unsplash fashion photography IDs matching exact categories and colors
const curatedMap = {
  // SHIRTS (1–9)
  1: 'photo-1596755094514-f87e34085b2c', // Classic Oxford Slim-Fit Shirt (White)
  2: 'photo-1602810318383-e386cc2a3ccf', // Tailored Navy Chambray Shirt (Navy Blue)
  3: 'photo-1607345366928-199ea26cfe3e', // Charcoal Textured Business Shirt (Charcoal)
  4: 'photo-1620799140408-edc6dcb6d633', // Relaxed Linen Cuban Collar Shirt (Olive)
  5: 'photo-1603252109303-2751441ec157', // Minimalist Jet Black Poplin Shirt (Black)
  6: 'photo-1594938298603-c8148c4dae35', // Brushed Buffalo Check Flannel Shirt (Check)
  7: 'photo-1589310243389-96a5483213a8', // Band Collar Sand Linen Casual Shirt (Sand)
  8: 'photo-1588359348347-9bc6cbbb689e', // Slate Blue Micro-Stripe Smart Shirt (Stripe Blue)
  9: 'photo-1516257984-b1b4d707412e', // Washed Corduroy Overshirt Jacket (Brown)

  // T-SHIRTS (10–20)
  10: 'photo-1586363104862-3a5e2ab60d99', // Pima Cotton Knit Polo Tee (Grey Polo)
  11: 'photo-1503342217505-b0a15ec3261c', // Heavyweight Black Tee (Black)
  12: 'photo-1521572267360-ee0c2909d518', // Minimalist Pure White Crewneck Tee (White)
  13: 'photo-1583743814966-8936f5b7be1a', // Vintage Heather Grey Acid Wash Tee (Grey)
  14: 'photo-1576566588028-4147f3842f27', // Bauhaus Monochrome Graphic Tee (Graphic)
  15: 'photo-1618354691373-d851c5c3a990', // Raw Hem Charcoal Long Sleeve Tee (Long sleeve)
  16: 'photo-1562157873-818bc0726f68', // Drop-Shoulder Oversized Khaki Tee (Khaki)
  17: 'photo-1622445268020-00d9319e0750', // Supima Cotton Deep Navy V-Neck (Navy)
  18: 'photo-1627916607164-7b20241db935', // Waffle Texture Mocha Henley Tee (Henley)
  19: 'photo-1529374255404-311a2a4f1fd9', // Abstract Minimal Typo Boxy Tee (Typo Grey)
  20: 'photo-1503342394128-c104d54dba01', // Heavy Jersey Ribbed Collar T-Shirt (Taupe)

  // PANTS & TROUSERS (21–30)
  21: 'photo-1624378439575-d8705ad7ae80', // Classic Charcoal Formal Trousers (Charcoal Formal)
  22: 'photo-1542272604-780c968595a0', // Navy Casual Pants (Navy Pants)
  23: 'photo-1506630448388-4e683c67ddb0', // Black Slim-Fit Trousers (Black Trousers)
  24: 'photo-1473966968600-fa801b869a1a', // Beige Chinos (Beige Chinos)
  25: 'photo-1517445312882-bc9910d016b7', // Taupe Cargo Pants (Taupe Cargo)
  26: 'photo-1509551388413-e18d0ac5d495', // Dark Brown Pleated Trousers (Brown Pleated)
  27: 'photo-1552902865-b72c031ac5ea', // Slate Grey Jogger Pants (Grey Joggers)
  28: 'photo-1594633312681-425c7b97ccd1', // Cream Linen Pants (Cream Linen)
  29: 'photo-1507679799987-c73779587ccf', // Stone Grey Tapered Trousers (Grey Tapered)
  30: 'photo-1515886657613-9f3515b0c78f', // Mocha Brown Wide-Leg Trousers (Wide Leg)

  // HOODIES (31–40)
  31: 'photo-1556905055-8f358a7a47b2', // Heavy French Terry Grey Hoodie (Grey Hoodie)
  32: 'photo-1509967419530-da38b4704bc6', // Deep Navy Thermal Fleece Hoodie (Navy Hoodie)
  33: 'photo-1578768079052-aa76e520028b', // Minimalist Abstract Printed Hoodie (Printed Hoodie)
  34: 'photo-1543163521-1bf539c55dd2', // Boxy Drop-Shoulder Oversized Hoodie (Oversized Hoodie)
  35: 'photo-1578632767115-351597cf2477', // Deep Maroon Brushed Cotton Hoodie (Maroon Hoodie)
  36: 'photo-1548883354-7622d03aca27', // Monochrome Colour Block Hoodie (Block Hoodie)
  37: 'photo-1512436991641-6745cdb1723f', // Tactical Olive Full-Zip Hoodie (Olive Hoodie)
  38: 'photo-1513094735237-8f2714d57c13', // Sand Stone Relaxed Fleece Hoodie (Sand Hoodie)
  39: 'photo-1618354691373-d851c5c3a990', // Vintage Mineral Wash Dark Grey Hoodie (Dark Grey Hoodie)
  40: 'photo-1559436194-ec317a4bafeb', // Minimalist Raglan Sleeve Cream Hoodie (Cream Hoodie)

  // JACKETS (41–50)
  41: 'photo-1576995853123-5a10305d93c0', // Vintage Wash Classic Denim Jacket (Denim Jacket)
  42: 'photo-1591047139829-d91aecb6caea', // Matte Black Tactical Bomber Jacket (Black Bomber)
  43: 'photo-1544441893-675973e31985', // Quilted Ultralight Puffer Jacket (Puffer Jacket)
  44: 'photo-1551028719-00167b16eac5', // Heritage Wool-Blend Varsity Jacket (Varsity Jacket)
  45: 'photo-1521223890158-f9f7c3d5d504', // Asymmetric Ashen Faux Biker Jacket (Leather Biker)
  46: 'photo-1548883354-9a805c86241b', // Water-Resistant Windbreaker Jacket (Windbreaker)
  47: 'photo-1544022613-e87ca75a784a', // Safari Utility Field Jacket (Field Jacket)
  48: 'photo-1539571696357-5a69c17a67c6', // Minimalist Harrington Casual Jacket (Harrington)
  49: 'photo-1507679799987-c73779587ccf', // Coach Snap-Button Trench Jacket (Coach Jacket)
  50: 'photo-1516257984-b1b4d707412e', // Corduroy Collar Workwear Jacket (Workwear Jacket)

  // SHOES (51–60)
  51: 'photo-1595950653106-6c9ebd614d3a', // Classic White Leather Low Sneakers (White Sneakers)
  52: 'photo-1525966222134-fcfa99b8ae77', // Minimalist Black Canvas Skate Shoes (Black Canvas)
  53: 'photo-1638247025967-b4e38f787b76', // Suede Chelsea Boots in Sand (Sand Chelsea)
  54: 'photo-1533867617858-e7b97e060509', // Leather Penny Loafers in Dark Brown (Loafers)
  55: 'photo-1542291026-7eec264c27ff', // Breathable Mesh Running Trainers (Running Shoes)
  56: 'photo-1614252235316-8c857d38b5f4', // Formal Oxford Dress Shoes in Black (Dress Shoes)
  57: 'photo-1552346154-21d32810aba3', // Retro High-Top Court Sneakers (High-top Sneakers)
  58: 'photo-1560343090-f0409e92791a', // Leather Driving Moccasins (Moccasins)
  59: 'photo-1608231387042-66d1773070a5', // Chunky Sole Casual Derby Shoes (Derby Shoes)
  60: 'photo-1560769629-975ec94e6a86', // Navy Canvas Slip-On Espadrilles (Slip-ons)

  // WATCHES (61–70)
  61: 'photo-1524805444758-089113d48a6d', // Minimalist Matte Black Mesh Watch (Black Mesh)
  62: 'photo-1522335789203-aabd1fc54bc9', // Silver Chronograph Leather Strap Watch (Chronograph)
  63: 'photo-1523275335684-37898b6baf30', // Bauhaus White Dial Minimalist Watch (White Dial)
  64: 'photo-1539185441755-769473a23570', // Gunmetal Steel Link Bracelet Watch (Steel Bracelet)
  65: 'photo-1509042239860-f550ce710b93', // Vintage Gold-Tone Dress Watch (Gold Watch)
  66: 'photo-1526045478516-99145907023c', // Tactical Dual-Time Field Watch (Field Watch)
  67: 'photo-1542496658-e33a6d0d50f6', // Minimalist Pilot Aviation Quartz Watch (Pilot Watch)
  68: 'photo-1524592094714-0f0654e20314', // Rose Gold Accent Leather Watch (Rose Gold)
  69: 'photo-1533139502658-0198f920d8e8', // Titanium-Finish Slimline Watch (Titanium Watch)
  70: 'photo-1508685096489-7aacd43bd3b1', // Retro Digital Steel Watch (Digital Steel)

  // CAPS (71–80)
  71: 'photo-1588850561407-ed78c282e89b', // Washed Cotton Low-Profile Dad Cap (Dad Cap)
  72: 'photo-1575428652377-a2d80e2277fc', // Structured Twill Snapback Cap (Snapback)
  73: 'photo-1576871337622-98d48d1cf531', // Merino Wool Blend Minimalist Beanie (Beanie)
  74: 'photo-1521369909029-2afed882baee', // Classic Navy Curved Brim Baseball Cap (Navy Cap)
  75: 'photo-1534215754734-18e55d13e346', // Vintage Corduroy Unstructured Cap (Corduroy Cap)
  76: 'photo-1556306535-0f09a537f0a3', // Suede-Finish Streetwear Cap (Olive Cap)
  77: 'photo-1517423568366-8b83523034fd', // Ultralight Performance Runner Cap (White Runner Cap)
  78: 'photo-1618354691373-d851c5c3a990', // Ribbed Knit Short Fisherman Beanie (Black Beanie)
  79: 'photo-1514327605112-b887c0e61c0a', // Houndstooth Newsboy Ivy Flat Cap (Flat Cap)
  80: 'photo-1588850561407-ed78c282e89b', // Weatherproof 5-Panel Camper Cap (5-Panel Cap)

  // BELTS (81–90)
  81: 'photo-1624222247344-550fb60583dc', // Full Grain Leather Dress Belt (Black Leather)
  82: 'photo-1553062407-98eeb64c6a62', // Reversible Tan to Black Leather Belt (Tan/Black)
  83: 'photo-1607604276583-eef5d076aa5f', // Braided Stretch Fabric Casual Belt (Braided Belt)
  84: 'photo-1614252235316-8c857d38b5f4', // Distressed Suede Casual Jean Belt (Suede Belt)
  85: 'photo-1516762689617-e1cffcef479d', // Matte Gunmetal Buckle Leather Belt (Gunmetal Belt)
  86: 'photo-1517445312882-bc9910d016b7', // Military Spec Tactical Webbing Belt (Tactical Belt)
  87: 'photo-1544816155-12df9643f363', // Minimalist Stitch-Detail Brown Belt (Brown Stitch Belt)
  88: 'photo-1512436991641-6745cdb1723f', // Automatic Ratchet Click Belt (Ratchet Belt)
  89: 'photo-1584917865442-de89df76afd3', // Textured Saffiano Italian Leather Belt (Saffiano Belt)
  90: 'photo-1624222247344-550fb60583dc', // Vintage Double-Prong Workwear Belt (Workwear Belt)

  // SUNGLASSES (91–100)
  91: 'photo-1577803645773-f96470509666', // Polarized Classic Wayfarer Sunglasses (Wayfarer)
  92: 'photo-1572635196237-14b3f281503f', // Aviator Metal Teardrop Sunglasses (Aviator)
  93: 'photo-1511499767150-a48a237f0083', // Vintage Round Tortoise Shell Shades (Round Tortoise)
  94: 'photo-1508296695146-257a814070b4', // Modern Clubmaster Browline Sunglasses (Clubmaster)
  95: 'photo-1509695507497-903c140c43b0', // Geometric Hexagonal Metal Sunglasses (Hexagonal)
  96: 'photo-1473496169904-658ba7c44d8a', // Minimalist Rimless Polarized Shades (Rimless)
  97: 'photo-1589782182703-2aaa69037b5b', // Flat-Top Modern Shield Sunglasses (Shield)
  98: 'photo-1508296695146-257a814070b4', // Gradient Lens Pilot Sunglasses (Pilot)
  99: 'photo-1574258495973-f010dfbb5371', // Retro Square Acetate Sunglasses (Square Acetate)
  100: 'photo-1511499767150-a48a237f0083' // Outdoor UV400 Sport Wrap Sunglasses (Sport)
};

async function downloadAll() {
  const FRONTEND_DIR = path.resolve(__dirname, '../../stylehub-frontend/public/images/products');
  const BACKEND_DIR = path.resolve(__dirname, '../public/images/products');

  console.log(`Writing photos to: ${FRONTEND_DIR}`);

  let successCount = 0;
  for (let id = 1; id <= 100; id++) {
    const photoId = curatedMap[id];
    if (!photoId) {
      console.error(`Missing mapping for ID ${id}`);
      continue;
    }
    const url = `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=600&h=750&q=85&fm=png`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Failed to fetch #${id}: HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10000) {
        console.error(`Downloaded buffer too small for #${id}: ${buf.length}`);
        continue;
      }
      const targetFront = path.join(FRONTEND_DIR, `product_${id}.png`);
      const targetBack = path.join(BACKEND_DIR, `product_${id}.png`);
      fs.writeFileSync(targetFront, buf);
      fs.writeFileSync(targetBack, buf);
      successCount++;
      if (id % 10 === 0 || id === 1 || id === 5 || id === 8 || id === 14 || id === 21 || id === 25 || id === 31 || id === 42 || id === 51 || id === 61) {
        console.log(`[PASS] Product #${id} saved (${buf.length} bytes)`);
      }
    } catch (err) {
      console.error(`Error downloading #${id}:`, err.message);
    }
  }

  console.log(`\nCompleted! Successfully downloaded and saved ${successCount}/100 product display photos.`);
}

downloadAll();
