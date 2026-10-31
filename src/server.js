import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './db.js';
const port = Number(process.env.PORT || 3000);
const server = createApp({ db: prisma }).listen(port, () => console.log(`API em http://localhost:${port}/v1/facilita`));
async function shutdown() { server.close(); await prisma.$disconnect(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
