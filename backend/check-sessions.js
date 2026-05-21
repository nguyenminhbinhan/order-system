const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.tableSession.findMany({
    include: {
      orders: {
        include: {
          items: true
        }
      }
    }
  });
  console.log(`Total sessions: ${sessions.length}`);
  sessions.forEach(s => {
    console.log(`Session ID: ${s.id}, TableId: ${s.tableId}, StartedAt: ${s.startedAt}, EndedAt: ${s.endedAt}, BillPrinted: ${s.billPrinted}`);
    console.log(`  Orders: ${s.orders.length}`);
    s.orders.forEach(o => {
      console.log(`    Order ID: ${o.id}, Status: ${o.status}`);
      o.items.forEach(i => {
        console.log(`      Item: ${i.name}, Status: ${i.status}, Qty: ${i.quantity}`);
      });
    });
  });
}

main().finally(() => prisma.$disconnect());
