const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting data migration...');
  
  // Update all pending orders to confirmed to match the new State Machine safely.
  // Using raw SQL to bypass Prisma Client enum caching if needed.
  try {
    const result = await prisma.$executeRawUnsafe(`UPDATE \`Order\` SET \`status\` = 'confirmed' WHERE \`status\` = 'pending'`);
    console.log(`Migration successful. Updated ${result} orders.`);
  } catch (err) {
    console.log('Migration error with Raw: ', err);
    console.log('Falling back to Prisma Client updateMany...');
    const fallbackResult = await prisma.order.updateMany({
      where: { status: 'pending' },
      data: { status: 'confirmed' }
    });
    console.log(`Fallback Migration successful. Updated ${fallbackResult.count} orders.`);
  }
}

main()
  .catch(e => {
    console.error('Fatal Migration Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
