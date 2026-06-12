FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --include=dev

COPY . .
RUN npm run build

RUN npm prune --omit=dev

EXPOSE 3000

CMD ["node", "server.cjs"]
