const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

const FIVE_USERS = [
  {
    username: 'akil_sundaram',
    fullName: 'Akil Sundaram',
    email: 'akil.sundaram@aksmenstyle.com',
    password: 'AkilStyle2026!',
    phone: '+91-9840112345',
    age: 29,
    address: '42 Poes Garden, Cathedral Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600086'
  },
  {
    username: 'rahul_devan',
    fullName: 'Rahul Devan',
    email: 'rahul.devan@aksmenstyle.com',
    password: 'RahulStyle2026!',
    phone: '+91-9880223456',
    age: 31,
    address: '18 Lavelle Road, Richmond Town',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001'
  },
  {
    username: 'karthik_raja',
    fullName: 'Karthik Raja',
    email: 'karthik.raja@aksmenstyle.com',
    password: 'KarthikStyle2026!',
    phone: '+91-9842334567',
    age: 27,
    address: '105 Race Course Road',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    pincode: '641018'
  },
  {
    username: 'siddharth_varma',
    fullName: 'Siddharth Varma',
    email: 'siddharth.varma@aksmenstyle.com',
    password: 'SiddharthStyle2026!',
    phone: '+91-9849445678',
    age: 33,
    address: '24 Jubilee Hills, Road No. 36',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033'
  },
  {
    username: 'vikram_rao',
    fullName: 'Vikramaditya Rao',
    email: 'vikram.rao@aksmenstyle.com',
    password: 'VikramStyle2026!',
    phone: '+91-9820556789',
    age: 35,
    address: '77 Altamount Road, Cumballa Hill',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400026'
  }
];

async function seedFiveUsers() {
  console.log('=== AK\'S MEN STYLE — SEEDING 5 VERIFIED REALISTIC USERS ===');

  for (const u of FIVE_USERS) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.password, salt);

    const existing = db.prepare('SELECT id, username, email FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?').get(u.email.toLowerCase(), u.username.toLowerCase());

    if (existing) {
      db.prepare(`
        UPDATE users
        SET full_name = ?, password_hash = ?, phone = ?, age = ?, address = ?, city = ?, state = ?, pincode = ?, role = 'USER', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(u.fullName, passwordHash, u.phone, u.age, u.address, u.city, u.state, u.pincode, existing.id);
      console.log(`✓ Updated User: [${existing.id}] ${u.username} (${u.email})`);
    } else {
      const res = db.prepare(`
        INSERT INTO users (username, full_name, email, password_hash, role, phone, age, address, city, state, pincode)
        VALUES (?, ?, ?, ?, 'USER', ?, ?, ?, ?, ?, ?)
      `).run(u.username, u.fullName, u.email, passwordHash, u.phone, u.age, u.address, u.city, u.state, u.pincode);
      console.log(`+ Created User: [${res.lastInsertRowid}] ${u.username} (${u.email})`);
    }
  }

  console.log('✅ 5 Verified Realistic Users seeded successfully!');
}

seedFiveUsers().catch(err => {
  console.error('[FATAL] Failed to seed 5 users:', err);
  process.exit(1);
});
