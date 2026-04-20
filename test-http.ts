import { PrismaClient } from '@modcart/db';

async function main() {
  const prisma = new PrismaClient();
  const jwt = require('jsonwebtoken');

  // get superadmin token
  const token = jwt.sign({ id: 'dummy', role: 'SUPERADMIN' }, 'super-secret', { expiresIn: '1h' });
  
  const res = await fetch('http://localhost:3001/api/v1/admin/features', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: "FeatHTTP", type: "TEXT", isGlobal: true, options: [] })
  });

  const body = await res.text();
  console.log('HTTP Feat. Result:', res.status, body);

  const res2 = await fetch('http://localhost:3001/api/v1/admin/products', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: "ProdHTTP", price: 100, stockQty: 10, vendorId: 'random-vendor-id', categoryIds: [] })
  });

  const body2 = await res2.text();
  console.log('HTTP Prod. Result:', res2.status, body2);
}

main();
