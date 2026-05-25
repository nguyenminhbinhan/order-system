/**
 * One-time migration script: Clean legacy local image references
 *
 * This script scans all MenuItem and ImageItem records and:
 *   1. Reports how many use Cloudinary URLs vs legacy local filenames
 *   2. Nullifies MenuItem.imageFilename for legacy local entries
 *   3. Deletes ImageItem records with legacy local filenames
 *   4. Never touches Cloudinary URLs
 *   5. Is fully idempotent — safe to run multiple times
 *
 * Usage (MANUAL ONLY — do NOT add to start:prod):
 *   npx ts-node prisma/migrate-images.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isCloudinaryUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('http');
}

async function main() {
  console.log('\n========================================');
  console.log('  IMAGE MIGRATION — Legacy Cleanup');
  console.log('========================================\n');

  // ── MenuItem.imageFilename analysis ──
  const allMenuItems = await prisma.menuItem.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, imageFilename: true },
  });

  let miCloudinary = 0;
  let miLegacy = 0;
  let miNull = 0;
  const miToClean: { id: string; name: string; imageFilename: string }[] = [];

  for (const item of allMenuItems) {
    if (!item.imageFilename) {
      miNull++;
    } else if (isCloudinaryUrl(item.imageFilename)) {
      miCloudinary++;
    } else {
      miLegacy++;
      miToClean.push({
        id: item.id,
        name: item.name,
        imageFilename: item.imageFilename,
      });
    }
  }

  console.log(`[MenuItem] Total: ${allMenuItems.length}`);
  console.log(`  ✅ Cloudinary URLs: ${miCloudinary}`);
  console.log(`  ⚠️  Legacy local:   ${miLegacy}`);
  console.log(`  ➖ No image:        ${miNull}`);

  if (miToClean.length > 0) {
    console.log(`\n  Cleaning ${miToClean.length} legacy MenuItem.imageFilename entries:`);
    for (const item of miToClean) {
      console.log(`    → [${item.name}] "${item.imageFilename}" → null`);
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { imageFilename: null },
      });
    }
    console.log(`  ✅ Cleaned ${miToClean.length} MenuItem records.`);
  } else {
    console.log('  ✅ No legacy MenuItem.imageFilename entries to clean.');
  }

  // ── ImageItem analysis ──
  const allImageItems = await prisma.imageItem.findMany({
    select: { id: true, menuId: true, image: true },
  });

  let iiCloudinary = 0;
  let iiLegacy = 0;
  const iiToDelete: { id: number; image: string }[] = [];

  for (const img of allImageItems) {
    if (isCloudinaryUrl(img.image)) {
      iiCloudinary++;
    } else {
      iiLegacy++;
      iiToDelete.push({ id: img.id, image: img.image });
    }
  }

  console.log(`\n[ImageItem] Total: ${allImageItems.length}`);
  console.log(`  ✅ Cloudinary URLs: ${iiCloudinary}`);
  console.log(`  ⚠️  Legacy local:   ${iiLegacy}`);

  if (iiToDelete.length > 0) {
    console.log(`\n  Deleting ${iiToDelete.length} legacy ImageItem records:`);
    for (const img of iiToDelete) {
      console.log(`    → ID ${img.id}: "${img.image}" → DELETED`);
    }
    const deleteResult = await prisma.imageItem.deleteMany({
      where: {
        id: { in: iiToDelete.map((i) => i.id) },
      },
    });
    console.log(`  ✅ Deleted ${deleteResult.count} ImageItem records.`);
  } else {
    console.log('  ✅ No legacy ImageItem records to clean.');
  }

  // ── Summary ──
  console.log('\n========================================');
  console.log('  MIGRATION COMPLETE');
  console.log('========================================');
  console.log(`  MenuItem cleaned:  ${miToClean.length}`);
  console.log(`  ImageItem deleted: ${iiToDelete.length}`);
  console.log(`  Cloudinary safe:   ${miCloudinary + iiCloudinary}`);
  console.log('========================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Migration error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
