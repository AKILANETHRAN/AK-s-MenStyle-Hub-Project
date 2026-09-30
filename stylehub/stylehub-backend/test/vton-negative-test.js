import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000';

function getAuthToken(userId) {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '1h' });
}

async function runNegativeTests() {
  console.log('=== RUNNING VTON NEGATIVE & SECURITY TEST SUITE ===');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      process.exit(1);
    }
  }

  // 1. Health check recognizes FASHN VTON v1.5 LOCAL
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  assert(healthRes.ok, '1. Health endpoint returns 200 OK');
  assert(healthData.vton && healthData.vton.includes('FASHN VTON v1.5 LOCAL'), '2. Health endpoint recognizes FASHN VTON v1.5 LOCAL');

  // 2. Unauthenticated VTON request
  const unauthRes = await fetch(`${BASE_URL}/api/vton/try-on`, { method: 'POST' });
  assert(unauthRes.status === 401, '3. Unauthenticated try-on request rejected with 401');

  // Generate tokens for User 1 and User 2
  const tokenUser1 = getAuthToken(1);
  const tokenUser2 = getAuthToken(2);

  // 3. No user photo provided
  const noPhotoForm = new FormData();
  noPhotoForm.append('productId', '1');
  const noPhotoRes = await fetch(`${BASE_URL}/api/vton/try-on`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenUser1}` },
    body: noPhotoForm
  });
  const noPhotoData = await noPhotoRes.json();
  assert(noPhotoRes.status === 400 && noPhotoData.error === 'Please upload your photo first.', '4. Missing user photo rejected with 400 and validation message');

  // 4. Invalid file format (text file disguised as image)
  const invalidFileForm = new FormData();
  invalidFileForm.append('productId', '1');
  const textBlob = new Blob(['dummy content'], { type: 'text/plain' });
  invalidFileForm.append('user_photo', textBlob, 'test.txt');
  const invalidFileRes = await fetch(`${BASE_URL}/api/vton/try-on`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenUser1}` },
    body: invalidFileForm
  });
  const invalidFileData = await invalidFileRes.json();
  assert(invalidFileRes.status === 400 && invalidFileData.error === 'Please upload a valid JPG, PNG, or WebP image.', '5. Invalid file format rejected with 400 and validation message');

  // 5. Product #51 (Accessory) - VTON unsupported
  const dummyImgBlob = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
  const accessoryForm = new FormData();
  accessoryForm.append('productId', '51');
  accessoryForm.append('user_photo', dummyImgBlob, 'photo.png');
  const accessoryRes = await fetch(`${BASE_URL}/api/vton/try-on`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenUser1}` },
    body: accessoryForm
  });
  const accessoryData = await accessoryRes.json();
  assert(accessoryRes.status === 400 && accessoryData.error === 'Virtual try-on is not available for this product.', '6. Accessory Product #51 rejected with 400 "Virtual try-on is not available for this product."');

  // 6. Invalid product ID (9999)
  const nonExistentForm = new FormData();
  nonExistentForm.append('productId', '9999');
  nonExistentForm.append('user_photo', dummyImgBlob, 'photo.png');
  const nonExistentRes = await fetch(`${BASE_URL}/api/vton/try-on`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenUser1}` },
    body: nonExistentForm
  });
  const nonExistentData = await nonExistentRes.json();
  assert(nonExistentRes.status === 404 && nonExistentData.error === 'Selected product could not be found.', '7. Non-existent product ID 9999 rejected with 404');

  // 7. Security: User isolation on try-on result endpoint
  // Check if try_on_results has any record or insert a test record
  import('../config/database.js').then(async ({ default: db }) => {
    // Insert dummy try-on result owned by User 1
    const dummyInsert = db.prepare(`
      INSERT INTO try_on_results (
        user_id, product_id, user_image_path, garment_image_path,
        generated_image_path, category, status
      ) VALUES (1, 1, 'test_user.png', '/images/garments/product_1.png', '/images/try-on/test_security.png', 'tops', 'COMPLETED')
    `);
    const insertInfo = dummyInsert.run();
    const resultId = insertInfo.lastInsertRowid;

    // User 1 access: should succeed (200)
    const ownerRes = await fetch(`${BASE_URL}/api/vton/results/${resultId}`, {
      headers: { 'Authorization': `Bearer ${tokenUser1}` }
    });
    assert(ownerRes.status === 200, '8. Owner (User 1) can view their own try-on result (200)');

    // User 2 access: should be rejected (403 Forbidden)
    const crossRes = await fetch(`${BASE_URL}/api/vton/results/${resultId}`, {
      headers: { 'Authorization': `Bearer ${tokenUser2}` }
    });
    assert(crossRes.status === 403, '9. Cross-user access (User 2 on User 1 result) strictly rejected with 403 Forbidden');

    // Clean up dummy test row
    db.prepare(`DELETE FROM try_on_results WHERE id = ?`).run(resultId);
    assert(true, '10. Security test cleanup completed');

    console.log(`\n=== ALL NEGATIVE & SECURITY TESTS PASSED (${passed}/${total}) ===\n`);
  });
}

runNegativeTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
