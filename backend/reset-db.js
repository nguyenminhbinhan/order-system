const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetTable1() {
  const table = await prisma.table.findFirst({ where: { name: 'Table 1' }});
  
  // Close all active sessions for Table 1
  await prisma.tableSession.updateMany({
    where: { tableId: table.id, endedAt: null },
    data: { endedAt: new Date() }
  });

  console.log('RESET BÀN 1 COMPLETE');
}

resetTable1().catch(console.error).finally(() => prisma.$disconnect());
