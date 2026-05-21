import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  // 1. Audit MenuItem table
  const items = await prisma.menuItem.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, imageFilename: true }
  });
  console.log('\n=== MENU ITEMS (imageFilename) ===');
  for (const item of items) {
    const filename = item.imageFilename || '(null)';
    let diskStatus = 'N/A';
    if (item.imageFilename) {
      const filePath = path.join(process.cwd(), 'uploads', item.imageFilename);
      diskStatus = fs.existsSync(filePath) ? 'EXISTS' : 'MISSING';
    }
    console.log(`  [${item.id.substring(0,8)}] ${item.name} | DB: "${filename}" | Disk: ${diskStatus}`);
  }

  // 2. Audit ImageItem table
  const images = await prisma.imageItem.findMany({
    select: { id: true, menuId: true, image: true }
  });
  console.log('\n=== IMAGE ITEMS (image) ===');
  for (const img of images) {
    const filename = img.image || '(null)';
    let diskStatus = 'N/A';
    if (img.image) {
      const filePath = path.join(process.cwd(), 'uploads', img.image);
      diskStatus = fs.existsSync(filePath) ? 'EXISTS' : 'MISSING';
    }
    console.log(`  [ImageItem ${img.id}] menuId: ${img.menuId.substring(0,8)} | DB: "${filename}" | Disk: ${diskStatus}`);
  }

  // 3. List actual files on disk
  const uploadsDir = path.join(process.cwd(), 'uploads');
  console.log(`\n=== FILES ON DISK (${uploadsDir}) ===`);
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      const stat = fs.statSync(path.join(uploadsDir, f));
      if (stat.isFile()) {
        console.log(`  ${f} (${stat.size} bytes)`);
      } else {
        console.log(`  ${f}/ (directory)`);
        // List inside subdirectory too
        const subFiles = fs.readdirSync(path.join(uploadsDir, f));
        for (const sf of subFiles) {
          const subStat = fs.statSync(path.join(uploadsDir, f, sf));
          console.log(`    ${f}/${sf} (${subStat.size} bytes)`);
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
