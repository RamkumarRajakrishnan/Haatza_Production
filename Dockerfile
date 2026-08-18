FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Force fresh build: 2026-08-18T18:20:00
ENV REBUILD_TIME=20260818182000
COPY . .
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN rm -rf dist node_modules/.prisma/client node_modules/@prisma/client
RUN npx prisma generate
RUN npm run build

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "run", "start:prod"]






