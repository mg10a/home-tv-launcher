FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/keesmod/ha-eufy-cam.git /upstream && cd /upstream && git checkout cb52d1347a8a69df10260a798b6d9fd969ba680d
WORKDIR /upstream/ha_app
COPY live-transcoder.ts ./src/live-transcoder.ts
COPY diagnostics.ts ./src/diagnostics.ts
COPY main.ts ./src/main.ts
COPY server.ts ./src/server.ts
RUN npm ci --ignore-scripts && npm run build && npm prune --omit=dev --ignore-scripts
# Try a newer HEVC decoder in the isolated DEV bridge only. Debian Trixie
# ships FFmpeg 7.1; the existing production bridge stays on Bookworm/5.1.
FROM node:24-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg tini && rm -rf /var/lib/apt/lists/* && ffmpeg -version | head -n 1 | grep -E '^ffmpeg version 7\.'
WORKDIR /app
COPY --from=build /upstream/ha_app/package*.json ./
COPY --from=build /upstream/ha_app/node_modules ./node_modules
COPY --from=build /upstream/ha_app/dist ./dist
COPY bootstrap.mjs ./
EXPOSE 8064
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "bootstrap.mjs"]
