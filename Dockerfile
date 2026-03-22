FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS deps
COPY package*.json ./
RUN npm install --only=production

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps    /app/node_modules ./node_modules
COPY . .
RUN mkdir -p logs
EXPOSE 5000
CMD ["node","src/server.js"]
