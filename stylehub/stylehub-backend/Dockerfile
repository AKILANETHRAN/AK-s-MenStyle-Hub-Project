FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

COPY --from=build /app ./

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
