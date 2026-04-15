import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'local-admin@slw.local' },
    update: { name: 'Local Admin', role: 'admin', isActive: true },
    create: {
      name: 'Local Admin',
      email: 'local-admin@slw.local',
      role: 'admin',
      isActive: true,
    },
  });

  console.log('Seed complete: local admin user ensured.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
