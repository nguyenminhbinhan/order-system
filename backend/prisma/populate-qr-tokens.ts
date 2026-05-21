import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  // Find all tables without qrToken (use raw query to bypass type constraints)
  const tables = await prisma.$queryRaw<{id: number; name: string; qrToken: string}[]>`
    SELECT id, name, qrToken FROM \`Table\` WHERE qrToken IS NULL OR qrToken = ''
  `;

  console.log(`Found ${tables.length} tables without qrToken`);

  for (const table of tables) {
    const token = uuidv4();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrUrl = `${frontendUrl}/table/${token}`;

    await prisma.table.update({
      where: { id: table.id },
      data: {
        qrToken: token,
        qrCode: qrUrl
      }
    });

    console.log(`  Table ${table.id} (${table.name}) → token: ${token}`);
  }

  console.log('Done! All tables now have unique QR tokens.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
