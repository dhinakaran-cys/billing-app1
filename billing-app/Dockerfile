FROM node:20-slim

WORKDIR /app

# Install build essentials for native better-sqlite3 compilation if needed
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Ensure data directory exists for SQLite storage
RUN mkdir -p data

EXPOSE 3000

ENV PORT=3000 \
    NODE_ENV=production

CMD ["npm", "start"]
