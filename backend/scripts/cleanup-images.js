const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const uploadDir = path.join(process.cwd(), 'uploads/images');

async function cleanup() {
  if (!fs.existsSync(uploadDir)) {
    console.log('Uploads directory does not exist. Skipping.');
    return;
  }

  const files = fs.readdirSync(uploadDir);
  const items = await prisma.menuItem.findMany({
    select: { imageFilename: true }
  });
  
  const activeImages = items.map(i => i.imageFilename).filter(Boolean);
  let removedCounts = 0;

  for (const file of files) {
    if (!activeImages.includes(file)) {
      console.log(`Removing orphaned image: ${file}`);
      fs.unlinkSync(path.join(uploadDir, file));
      removedCounts++;
    }
  }

  console.log(`Cleanup complete. Removed ${removedCounts} orphaned images.`);
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());
