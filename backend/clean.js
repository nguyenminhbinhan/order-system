const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  const tables = await prisma.table.findMany();
  let closed = 0;
  for (const t of tables) {
    const sessions = await prisma.tableSession.findMany({ 
      where: { tableId: t.id, endedAt: null }, 
      orderBy: { startedAt: 'desc' } 
    });
    
    if (sessions.length > 1) {
       for(let i = 1; i < sessions.length; i++) {
         await prisma.tableSession.update({ 
           where: { id: sessions[i].id }, 
           data: { endedAt: new Date(), totalAmount: 0 } 
         });
         closed++;
       }
    }
  }
  return closed;
}

clean()
  .then((c) => console.log('DONE. Closed ghost sessions:', c))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
