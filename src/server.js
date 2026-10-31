import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './db.js';
import { validateProductionConfig } from './config.js';
validateProductionConfig();
const port = Number(process.env.PORT || 3000);
const server = createApp({ db: prisma }).listen(port, () => console.log(`API em http://localhost:${port}/v1/facilita`));
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    try { await prisma.$disconnect(); process.exitCode = 0; }
    catch (error) { console.error('Erro ao desconectar banco', error); process.exitCode = 1; }
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
