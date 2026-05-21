const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== TABLES ===');
  const tables = await prisma.table.findMany();
  console.log(JSON.stringify(tables, null, 2));

  console.log('\n=== TABLE SESSIONS ===');
  const sessions = await prisma.tableSession.findMany();
  console.log(JSON.stringify(sessions, null, 2));

  console.log('\n=== ORDERS ===');
  const orders = await prisma.order.findMany({
    include: {
      items: true
    }
  });
  console.log(JSON.stringify(orders, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
