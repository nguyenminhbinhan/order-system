const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const table = await prisma.table.findFirst({ where: { name: 'Table 1' }});
  let session = await prisma.tableSession.findFirst({ where: { tableId: table.id, endedAt: null }});
  if (!session) {
    session = await prisma.tableSession.create({ data: { tableId: table.id }});
  }
  const menuItem = await prisma.menuItem.findFirst();
  const order = await prisma.order.create({
    data: {
      tableId: table.id,
      sessionId: session.id,
      status: 'pending_confirmation',
      totalAmount: menuItem.price,
      items: {
        create: [
          {
            menuItemId: menuItem.id,
            name: menuItem.name,
            quantity: 1,
            price: menuItem.price
          }
        ]
      }
    }
  });
  console.log('ORDER SEEDED:', order.id);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
