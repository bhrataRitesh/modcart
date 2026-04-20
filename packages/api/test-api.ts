import { PrismaClient } from '@modcart/db';

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('Connected to DB');

    console.log('Prisma feature object exists:', !!prisma.feature);
    
    if (prisma.feature) {
      const feat = await prisma.feature.create({
        data: { name: 'Test Feat', type: 'TEXT', isGlobal: true, options: [] }
      });
      console.log('Feature created:', feat);
      await prisma.feature.delete({ where: { id: feat.id } });
    }
  } catch (error) {
    console.error('Test Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}
main();
