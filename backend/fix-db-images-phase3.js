const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.menuItem.findMany();
  let updated = 0;
  for (const item of items) {
    if (item.imageFilename && (item.imageFilename.includes('(') || item.imageFilename.includes(')'))) {
      const newName = item.imageFilename.replace(/\(/g, '_').replace(/\)/g, '_');
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { imageFilename: newName }
      });
      console.log(`Updated DB: ${item.imageFilename} -> ${newName}`);
      updated++;
    }
  }
  console.log(`Finished updating ${updated} database records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
