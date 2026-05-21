const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activeOrders = await prisma.order.findMany({
    where: {
      session: {
        endedAt: null
      },
      status: {
        not: 'cancelled'
      }
    },
    include: {
      table: true,
      session: true,
      items: {
        include: {
          menuItem: true
        }
      }
    }
  });
  console.log(`Active orders count: ${activeOrders.length}`);
  activeOrders.forEach(o => {
    console.log(`Order ID: ${o.id}, Status: ${o.status}, TableId: ${o.tableId}, SessionId: ${o.sessionId}`);
    o.items.forEach(i => {
      console.log(`  Item: ${i.name}, Quantity: ${i.quantity}, Status: ${i.status}`);
    });
  });
}

main().finally(() => prisma.$disconnect());
