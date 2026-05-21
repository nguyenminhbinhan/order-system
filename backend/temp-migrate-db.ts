import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating database rows...');
  
  const updatedItems = await prisma.orderItem.updateMany({
    where: { status: 'done' as any },
    data: { status: 'ready' }
  });
  console.log(`Updated ${updatedItems.count} order items from 'done' to 'ready'.`);

  const updatedOrders = await prisma.order.updateMany({
    where: { status: 'completed' as any },
    data: { status: 'ready' }
  });
  console.log(`Updated ${updatedOrders.count} orders from 'completed' to 'ready'.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
