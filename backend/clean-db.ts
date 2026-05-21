import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data migration to remove double prefix...');
    
    // 1. Clean MenuItem imageFilename
    const items = await prisma.menuItem.findMany();
    for (const item of items) {
        if (item.imageFilename) {
            const clean = item.imageFilename.replace('/uploads/images/', '').replace('/uploads/', '');
            if (clean !== item.imageFilename) {
                await prisma.menuItem.update({
                    where: { id: item.id },
                    data: { imageFilename: clean }
                });
                console.log(`[MenuItem] Cleaned ${item.id}: ${item.imageFilename} -> ${clean}`);
            }
        }
    }

    // 2. Clean MenuItemImage relation table
    const images = await prisma.imageItem.findMany();
    for (const img of images) {
        if (img.image) {
            const clean = img.image.replace('/uploads/images/', '').replace('/uploads/', '');
            if (clean !== img.image) {
                await prisma.imageItem.update({
                    where: { id: img.id },
                    data: { image: clean }
                });
                console.log(`[MenuItemImage] Cleaned ${img.id}: ${img.image} -> ${clean}`);
            }
        }
    }

    console.log('Migration successfully completed!');
}

main()
    .then(() => prisma.$disconnect())
    .catch((error) => {
        console.error('Migration failed:', error);
        prisma.$disconnect();
        process.exit(1);
    });
