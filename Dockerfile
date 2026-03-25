# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.13.1

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
ENV CI=true
ENV npm_config_build_from_source=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json

RUN npm ci

FROM deps AS build
COPY . .

RUN npm run build --workspace server \
  && npm run build --workspace client

FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
WORKDIR /app
ENV CI=true
ENV npm_config_build_from_source=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/package.json

RUN npm ci --omit=dev --workspace server --include-workspace-root \
  && npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=prod-deps --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nonroot:nonroot /app/package.json ./package.json
COPY --from=build --chown=nonroot:nonroot /app/client/dist ./client/dist
COPY --from=prod-deps --chown=nonroot:nonroot /app/server/package.json ./server/package.json
COPY --from=build --chown=nonroot:nonroot /app/server/dist ./server/dist
COPY --chown=nonroot:nonroot data/.gitkeep ./data/.gitkeep

VOLUME ["/app/data"]
EXPOSE 4000

CMD ["server/dist/server/src/index.js"]
