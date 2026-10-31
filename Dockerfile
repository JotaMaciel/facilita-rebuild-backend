FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
RUN npm run db:generate
COPY src ./src
USER node
EXPOSE 3000
CMD ["node","src/server.js"]
