import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000';
const MODEL_PHOTO_PATH = path.join(
  __dirname, '..', '..', '..', 'stylehub-frontend-merged', 'stylehub-backend',
  'vton-service', 'fashn-repo', 'examples', 'data', 'model.webp'
);

function getAuthToken(userId = 1) {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '1h' });
}

async function testSingleProduct(productId, expectedName, expectedCat) {
  console.log(`\n==================================================`);
  console.log(`Testing Real VTON for Product #${productId}: ${expectedName}`);
  console.log(`==================================================`);

  // 1. Fetch Product Metadata
  const prodRes = await fetch(`${BASE_URL}/api/products/${productId}`);
  if (!prodRes.ok) throw new Error(`Failed to fetch product ${productId}`);
  const product = await prodRes.json();
  console.log(`✓ Product Name: ${product.name}`);
  console.log(`✓ Category: ${product.category}`);
  console.log(`✓ VTON Supported: ${product.vton_supported}`);
  console.log(`✓ Exact Garment Asset: ${product.garment_image}`);

  if (product.vton_supported !== 1) {
    throw new Error(`Product ${productId} is not marked as vton_supported!`);
  }
  if (!product.garment_image) {
    throw new Error(`Product ${productId} has no garment_image!`);
  }

  // 2. Read User Photo
  const userPhotoBuf = fs.readFileSync(MODEL_PHOTO_PATH);
  const userPhotoBlob = new Blob([userPhotoBuf], { type: 'image/webp' });

  // 3. Send to Express Backend (acting as bridge to Flask)
  const token = getAuthToken(1);
  const form = new FormData();
  form.append('productId', String(productId));
  form.append('user_photo', userPhotoBlob, 'model.webp');
  form.append('num_timesteps', '12');

  console.log(`[VTON Request] Sending to Express /api/vton/try-on (Bridge -> Flask FASHN v1.5 on CUDA)...`);
  const startTime = Date.now();

  const response = await fetch(`${BASE_URL}/api/vton/try-on`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Try-on failed with HTTP ${response.status}: ${errorData.error || errorData.message}`);
  }

  const resultData = await response.json();
  console.log(`✓ Response Status: HTTP 200 OK (in ${elapsed}s)`);
  console.log(`✓ Result URL: ${resultData.result_url}`);
  console.log(`✓ Result ID: ${resultData.result_id}`);

  // 4. Verify Generated Asset on Disk and HTTP serving
  const resultDiskPath = path.join(__dirname, '..', 'public', resultData.result_url.replace('/images/', 'images/'));
  if (!fs.existsSync(resultDiskPath)) {
    throw new Error(`Generated file does not exist on disk: ${resultDiskPath}`);
  }

  const stat = fs.statSync(resultDiskPath);
  console.log(`✓ Output file size: ${stat.size} bytes`);
  if (stat.size < 5000) {
    throw new Error(`Generated image file is suspiciously small (${stat.size} bytes)`);
  }

  // 5. Test Download Simulation (HTTP fetch of result image)
  const imgRes = await fetch(`${BASE_URL}${resultData.result_url}`);
  if (!imgRes.ok) {
    throw new Error(`Failed to download/fetch generated image over HTTP: ${imgRes.status}`);
  }
  const contentType = imgRes.headers.get('content-type');
  console.log(`✓ Download HTTP Status: 200 OK (Content-Type: ${contentType})`);

  console.log(`✓ Product #${productId} PASSED full real inference and verification!`);
  return {
    productId,
    name: product.name,
    elapsed,
    resultUrl: resultData.result_url,
    fileSize: stat.size
  };
}

async function runAll() {
  console.log('=== STARTING REAL VTON END-TO-END INFERENCE TESTS ===');
  console.log('Using model image: ' + MODEL_PHOTO_PATH);
  
  const testItems = [
    { id: 1, name: 'Classic Oxford Slim-Fit Shirt', cat: 'Shirts' },
    { id: 10, name: 'Pima Cotton Knit Polo Tee', cat: 'T-Shirts' },
    { id: 21, name: 'Classic Charcoal Formal Trousers', cat: 'Pants & Trousers' },
    { id: 27, name: 'Slate Grey Jogger Pants', cat: 'Pants & Trousers' }
  ];

  const results = [];
  for (const item of testItems) {
    const res = await testSingleProduct(item.id, item.name, item.cat);
    results.push(res);
  }

  console.log('\n==================================================');
  console.log('=== REAL VTON REGRESSION RESULTS (ALL 4 PASSED) ===');
  console.log('==================================================');
  results.forEach(r => {
    console.log(`Product #${r.productId} (${r.name}): ${r.elapsed}s, size: ${r.fileSize} bytes, url: ${r.resultUrl}`);
  });
  console.log('==================================================\n');
}

runAll().catch(err => {
  console.error('\n[REGRESSION ERROR]', err);
  process.exit(1);
});
