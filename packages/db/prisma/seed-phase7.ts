import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Phase 7 Permissions and Groups...');

  // 1. Create Permissions
  const permissions = [
    { action: 'manage_categories', description: 'Can create, update, delete categories' },
    { action: 'manage_users', description: 'Can create, update, delete users' },
    { action: 'manage_vendors', description: 'Can approve and manage vendors' },
    { action: 'manage_plans', description: 'Can manage vendor plans' },
    { action: 'manage_products_all', description: 'Can moderate all products' },
    { action: 'view_analytics', description: 'Can view platform analytics' },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { action: p.action },
      update: {},
      create: p,
    });
  }

  // 2. Create Default Groups
  const allPermissions = await prisma.permission.findMany();
  
  await prisma.userGroup.upsert({
    where: { name: 'Super Admin' },
    update: {
      permissions: { set: allPermissions.map(p => ({ id: p.id })) }
    },
    create: {
      name: 'Super Admin',
      description: 'Has all permissions',
      permissions: { connect: allPermissions.map(p => ({ id: p.id })) }
    }
  });

  const contentModeratorPerms = allPermissions.filter(p => 
    p.action === 'manage_categories' || p.action === 'manage_products_all'
  );

  await prisma.userGroup.upsert({
    where: { name: 'Content Moderator' },
    update: {
      permissions: { set: contentModeratorPerms.map(p => ({ id: p.id })) }
    },
    create: {
      name: 'Content Moderator',
      description: 'Can manage content but not users or billing',
      permissions: { connect: contentModeratorPerms.map(p => ({ id: p.id })) }
    }
  });

  // 3. Create Default Vendor Plans
  const plans = [
    { name: 'Basic', price: 0, maxProducts: 50, commissionRate: 10.0, features: ['basic_analytics'] },
    { name: 'Pro', price: 29.99, maxProducts: 500, commissionRate: 7.5, features: ['basic_analytics', 'priority_support', 'featured_listings'] },
    { name: 'Enterprise', price: 99.99, maxProducts: 5000, commissionRate: 5.0, features: ['basic_analytics', 'priority_support', 'featured_listings', 'api_access'] },
  ];

  for (const plan of plans) {
    await prisma.vendorPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  console.log('✅ Phase 7 Seeding Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
