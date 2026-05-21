const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.menuItem.findMany();
  let updated = 0;
  for (const item of items) {
    if (item.imageUrl && (item.imageUrl.includes(' ') || item.imageUrl.includes('(') || item.imageUrl.includes(')'))) {
      const newUrl = item.imageUrl.replace(/\s+/g, '_').replace(/\(/g, '_').replace(/\)/g, '');
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { imageUrl: newUrl }
      });
      console.log(`Updated ${item.imageUrl} -> ${newUrl}`);
      updated++;
    }
  }
  console.log(`Finished updating ${updated} records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
