# No QR, password or private footage enters this image. Build downloads a pinned
# public source commit. The running installer has no need for network access.
FROM alpine:3.21
RUN apk add --no-cache ca-certificates curl unzip jq
ARG VTECH_SOURCE_COMMIT=21b53f628fd511dfd03568bd1ad357a235ea42dd
RUN set -eu; \
    curl --fail --location --silent --show-error --retry 3 --connect-timeout 15 --max-time 120 \
      "https://codeload.github.com/mg10a/home-tv-launcher/zip/\${VTECH_SOURCE_COMMIT}" \
      --output /tmp/halo-vtech-source.zip; \
    unzip -q /tmp/halo-vtech-source.zip -d /tmp/halo-vtech-source; \
    package="/tmp/halo-vtech-source/home-tv-launcher-\${VTECH_SOURCE_COMMIT}/vtech_baby"; \
    test -f "\${package}/custom_components/vtech_baby/manifest.json"; \
    test -f "\${package}/custom_components/vtech_baby/vtech_lan/profile.py"; \
    mv "\${package}/custom_components/vtech_baby" /opt/vtech_baby; \
    cp "\${package}/LICENSE" /opt/vtech_baby/LICENSE; \
    cp "\${package}/README.md" /opt/vtech_baby/README.md; \
    test "$(jq -r '.domain' /opt/vtech_baby/manifest.json)" = vtech_baby; \
    test "$(jq -r '.version' /opt/vtech_baby/manifest.json)" = 0.3.1; \
    rm -rf /tmp/halo-vtech-source /tmp/halo-vtech-source.zip
COPY run.sh /run.sh
RUN chmod 0755 /run.sh
CMD ["/run.sh"]
