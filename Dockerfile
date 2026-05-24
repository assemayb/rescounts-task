FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY vitest.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
COPY sql ./sql

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
