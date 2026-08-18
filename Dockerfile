FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# Force cache invalidation build: 2026-08-18T12:31:00
ENV CACHEBUST=20260818123100
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN npx prisma generate --no-engine
RUN npx prisma generate
RUN npm run build

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "run", "start:prod"]






