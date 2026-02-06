# Postgres with GCS Dump/Restore for Cloud Run
#
# Wraps postgres:16-alpine with:
# - Google Cloud SDK (gcloud storage commands)
# - Custom entrypoint that restores from GCS on startup
#   and dumps to GCS on SIGTERM + periodic intervals
#
# Environment variables:
#   GCS_BUCKET             - GCS bucket for dumps (required)
#   DUMP_INTERVAL_SECONDS  - Dump interval (default: 300)
#   POSTGRES_USER          - DB user (required)
#   POSTGRES_PASSWORD      - DB password (required)
#   POSTGRES_DB            - DB name (default: asdlc_ideation)

FROM postgres:16-alpine

# Install gcloud CLI (minimal, for storage operations only)
RUN apk add --no-cache python3 py3-pip curl bash \
    && curl -sSL https://sdk.cloud.google.com > /tmp/install.sh \
    && bash /tmp/install.sh --disable-prompts --install-dir=/opt \
    && rm /tmp/install.sh \
    && ln -s /opt/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud \
    && ln -s /opt/google-cloud-sdk/bin/gsutil /usr/local/bin/gsutil \
    && gcloud components install --quiet 2>/dev/null || true

# Copy init script for fresh databases (no GCS dump available)
COPY init.sql /docker-entrypoint-initdb.d/init.sql

# Copy custom entrypoint
COPY entrypoint.sh /usr/local/bin/postgres-gcs-entrypoint.sh
RUN chmod +x /usr/local/bin/postgres-gcs-entrypoint.sh

ENV POSTGRES_DB=asdlc_ideation
ENV DUMP_INTERVAL_SECONDS=300

# Cloud Run sends SIGTERM with configurable grace period
STOPSIGNAL SIGTERM

ENTRYPOINT ["postgres-gcs-entrypoint.sh"]
