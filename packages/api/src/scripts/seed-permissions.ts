import { prisma } from '@modcart/db';

/**
 * Seed default permissions and user groups.
 * Idempotent — safe to run multiple times.
 */
const DEFAULT_PERMISSIONS = [
  { action: 'manage_products', description: 'Create, edit, delete products' },
  { action: 'manage_orders', description: 'View and manage all orders' },
  { action: 'manage_categories', description: 'Create, edit, delete categories' },
  { action: 'manage_users', description: 'Create, edit, ban users' },
  { action: 'manage_vendors', description: 'Approve, suspend, configure vendors' },
  { action: 'manage_settings', description: 'Access marketplace configuration' },
  { action: 'view_analytics', description: 'View dashboard analytics and reports' },
  { action: 'manage_promotions', description: 'Create and manage coupons, flash sales' },
  { action: 'manage_content', description: 'Manage blog posts, CMS pages, banners' },
  { action: 'manage_shipping', description: 'Configure shipping zones and methods' },
  { action: 'manage_taxes', description: 'Configure tax zones and rules' },
  { action: 'manage_returns', description: 'Process return/refund requests' },
  { action: 'moderate_products', description: 'Approve or reject vendor product submissions' },
];

const DEFAULT_GROUPS = [
  {
    name: 'Super Admin',
    description: 'Full access to all marketplace features',
    permissionActions: DEFAULT_PERMISSIONS.map(p => p.action), // all permissions
  },
  {
    name: 'Content Moderator',
    description: 'Manage content, categories, and moderate products',
    permissionActions: ['manage_categories', 'manage_content', 'moderate_products'],
  },
  {
    name: 'Order Manager',
    description: 'View and manage orders and returns',
    permissionActions: ['manage_orders', 'manage_returns', 'view_analytics'],
  },
  {
    name: 'Vendor Manager',
    description: 'Approve and manage vendor profiles',
    permissionActions: ['manage_vendors', 'view_analytics'],
  },
];

export async function seedPermissions() {
  console.log('🔐 Seeding permissions...');

  // Upsert all permissions
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { action: perm.action },
      update: { description: perm.description },
      create: perm,
    });
  }

  console.log(`   ✅ ${DEFAULT_PERMISSIONS.length} permissions seeded`);

  // Upsert all groups
  for (const group of DEFAULT_GROUPS) {
    const permissions = await prisma.permission.findMany({
      where: { action: { in: group.permissionActions } },
    });

    const existing = await prisma.userGroup.findUnique({ where: { name: group.name } });

    if (existing) {
      await prisma.userGroup.update({
        where: { name: group.name },
        data: {
          description: group.description,
          permissions: { set: permissions.map(p => ({ id: p.id })) },
        },
      });
      console.log(`   🔄 Updated group: ${group.name}`);
    } else {
      await prisma.userGroup.create({
        data: {
          name: group.name,
          description: group.description,
          permissions: { connect: permissions.map(p => ({ id: p.id })) },
        },
      });
      console.log(`   ✨ Created group: ${group.name}`);
    }
  }

  console.log('🔐 Permission seeding complete!\n');
}

// Allow running directly: npx tsx packages/api/src/scripts/seed-permissions.ts
if (require.main === module) {
  seedPermissions()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
