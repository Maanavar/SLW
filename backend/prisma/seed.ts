import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/services/passwordService';

const prisma = new PrismaClient();

async function main() {
  const bootstrapPassword = process.env.ADMIN_API_KEY?.trim() || 'change-me';
  const passwordHash = await hashPassword(bootstrapPassword);
  const adminEmail = process.env.AUTH_DEFAULT_ADMIN_EMAIL?.trim() || 'local-admin@slw.local';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Local Admin',
      role: 'admin',
      isActive: true,
      passwordHash,
    },
    create: {
      name: 'Local Admin',
      email: adminEmail,
      role: 'admin',
      isActive: true,
      passwordHash,
    },
  });

  console.log('Seed complete: local admin user ensured (password sourced from ADMIN_API_KEY).');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
