const jwt = require('jsonwebtoken');

async function main() {
  const token = jwt.sign({ id: 'dummy', role: 'SUPERADMIN' }, 'super-secret', { expiresIn: '1h' });
  const API_URL = 'http://localhost:3001';
  const VENDOR_ID = 'cmnkc5qca0003vyy8o5rt6f9i';

  console.log('--- Testing Feature Creation ---');
  const featRes = await fetch(`${API_URL}/api/v1/admin/features`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: "FeatTest", type: "TEXT", isGlobal: true, options: [] })
  });
  console.log('Feature Status:', featRes.status);
  console.log('Feature Body:', await featRes.text());

  console.log('\n--- Testing Product Creation ---');
  const prodRes = await fetch(`${API_URL}/api/v1/admin/products`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      name: "ProdTest", 
      price: 150, 
      stockQty: 20, 
      vendorId: VENDOR_ID,
      images: [{ url: "https://via.placeholder.com/150", alt: "test" }],
      categoryIds: []
    })
  });
  console.log('Product Status:', prodRes.status);
  console.log('Product Body:', await prodRes.text());
}

main();
