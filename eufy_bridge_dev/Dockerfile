FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/keesmod/ha-eufy-cam.git /upstream && cd /upstream && git checkout cb52d1347a8a69df10260a798b6d9fd969ba680d
WORKDIR /upstream/ha_app
COPY live-transcoder.ts ./src/live-transcoder.ts
COPY diagnostics.ts ./src/diagnostics.ts
RUN npm ci --ignore-scripts && npm run build && npm prune --omit=dev --ignore-scripts
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /upstream/ha_app/package*.json ./
COPY --from=build /upstream/ha_app/node_modules ./node_modules
COPY --from=build /upstream/ha_app/dist ./dist
COPY --from=build /upstream/ha_app/bootstrap.mjs ./
EXPOSE 8063
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "bootstrap.mjs"]
