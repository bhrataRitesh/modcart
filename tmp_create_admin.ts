import { prisma } from './packages/db/src';
import { hashPassword } from './packages/core/src';

async function createAdmin() {
  const email = 'ratohikumar@gmail.com';
  const password = 'Ritesh@843';
  
  const hashedPassword = await hashPassword(password);
  
  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'SUPERADMIN',
        passwordHash: hashedPassword,
        firstName: 'Ritesh',
        lastName: 'Kumar',
      },
      create: {
        email,
        passwordHash: hashedPassword,
        firstName: 'Ritesh',
        lastName: 'Kumar',
        role: 'SUPERADMIN',
      },
    });
    
    console.log('Admin user created/updated successfully:', user.email);
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
