FROM node:20-alpine

RUN apk add --no-cache openssl ca-certificates libc6-compat

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "run", "start:prod"]






