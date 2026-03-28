# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.14.0

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
ENV CI=true

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json

RUN npm ci

FROM deps AS build
COPY . .

RUN npm run build --workspace server \
  && npm run build --workspace client

FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app
ENV CI=true

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY server/package.json server/package.json

RUN npm ci --omit=dev --workspace server --include-workspace-root \
  && npm cache clean --force

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/client/dist ./client/dist
COPY --from=prod-deps --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --chown=node:node data/.gitkeep ./data/.gitkeep

VOLUME ["/app/data"]
EXPOSE 4000

USER node

CMD ["node", "server/dist/server/src/index.js"]
