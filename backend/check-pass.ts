import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.user.findMany({ select: { email: true, role: true, password: true } })
  .then(u => console.log(JSON.stringify(u, null, 2)))
  .finally(() => p.$disconnect());
