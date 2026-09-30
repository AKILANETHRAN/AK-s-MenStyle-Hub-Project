async function testHttpAuth() {
  console.log('Testing HTTP Auth endpoints against http://localhost:5000...');

  // 1. Register a test user
  const regEmail = `http.user.${Date.now()}@example.com`;
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'HTTP Test User',
      email: regEmail,
      password: 'HttpPassword123!',
      phone: '1234567890',
      age: 25,
      city: 'Bangalore',
      state: 'Karnataka'
    })
  });

  const regData = await regRes.json();
  if (regRes.status !== 201 || !regData.token) {
    throw new Error(`Register failed: ${JSON.stringify(regData)}`);
  }
  console.log('[PASS] HTTP Register succeeded, username generated:', regData.user.username);

  // 2. Login with correct credentials
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: regEmail,
      password: 'HttpPassword123!'
    })
  });
  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.token) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }
  console.log('[PASS] HTTP Login succeeded, token received');

  const token = loginData.token;

  // 3. Test /api/auth/me with token
  const meRes = await fetch('http://localhost:5000/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meData = await meRes.json();
  if (meRes.status !== 200 || meData.email !== regEmail) {
    throw new Error(`/api/auth/me failed: ${JSON.stringify(meData)}`);
  }
  console.log('[PASS] HTTP GET /api/auth/me returned correct user profile:', meData.fullName);

  // 4. Test /api/auth/me without token (must return 401)
  const unauthRes = await fetch('http://localhost:5000/api/auth/me');
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 without token, got: ${unauthRes.status}`);
  }
  console.log('[PASS] HTTP GET /api/auth/me rejected unauthorized request with 401');

  // 5. Test /api/auth/profile update
  const updateRes = await fetch('http://localhost:5000/api/auth/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      fullName: 'Updated HTTP Name',
      city: 'Mumbai',
      age: 26
    })
  });
  const updateData = await updateRes.json();
  if (updateRes.status !== 200 || updateData.fullName !== 'Updated HTTP Name' || updateData.city !== 'Mumbai') {
    throw new Error(`Profile update failed: ${JSON.stringify(updateData)}`);
  }
  console.log('[PASS] HTTP PUT /api/auth/profile succeeded with updated fields');

  console.log('\nAll HTTP Auth endpoints verified successfully!');
}

testHttpAuth().catch(err => {
  console.error('HTTP test error:', err);
  process.exit(1);
});
