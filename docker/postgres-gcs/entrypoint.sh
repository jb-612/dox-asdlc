#!/bin/bash
# Postgres GCS Dump/Restore Entrypoint for Cloud Run
#
# Wraps the official postgres entrypoint with:
# 1. GCS restore on startup (if dump exists)
# 2. Periodic GCS dump while running
# 3. Final GCS dump on SIGTERM before shutdown
#
# Environment variables:
#   GCS_BUCKET          - GCS bucket name (required)
#   DUMP_INTERVAL_SECONDS - Seconds between periodic dumps (default: 300)
#   POSTGRES_USER       - Postgres user (required, passed to postgres)
#   POSTGRES_PASSWORD   - Postgres password (required, passed to postgres)
#   POSTGRES_DB         - Postgres database name (default: asdlc_ideation)

set -euo pipefail

: "${GCS_BUCKET:?GCS_BUCKET environment variable is required}"
: "${POSTGRES_USER:?POSTGRES_USER environment variable is required}"
: "${POSTGRES_DB:=asdlc_ideation}"
: "${DUMP_INTERVAL_SECONDS:=300}"

GCS_DUMP_PATH="gs://${GCS_BUCKET}/latest.sql.gz"
LOCAL_RESTORE="/tmp/restore.sql.gz"
PG_PID=""

log() {
    echo "[postgres-gcs] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"
}

# Download dump from GCS if it exists
download_dump() {
    log "Checking GCS for existing dump at ${GCS_DUMP_PATH}..."
    if gcloud storage cp "${GCS_DUMP_PATH}" "${LOCAL_RESTORE}" 2>/dev/null; then
        log "Found existing dump ($(du -h "${LOCAL_RESTORE}" | cut -f1))"
        return 0
    else
        log "No existing dump found in GCS. Will use init.sql for fresh schema."
        return 1
    fi
}

# Restore dump into running Postgres
restore_dump() {
    if [ ! -f "${LOCAL_RESTORE}" ]; then
        return 0
    fi

    log "Waiting for Postgres to be ready..."
    for i in $(seq 1 30); do
        if pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -q 2>/dev/null; then
            break
        fi
        sleep 1
    done

    log "Restoring dump into ${POSTGRES_DB}..."
    # Drop and recreate to avoid conflicts with init.sql schema
    gunzip -c "${LOCAL_RESTORE}" | psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
        --single-transaction --set ON_ERROR_STOP=off 2>/dev/null || true

    rm -f "${LOCAL_RESTORE}"
    log "Restore complete."
}

# Dump Postgres to GCS
dump_to_gcs() {
    if ! pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -q 2>/dev/null; then
        log "Postgres not ready, skipping dump."
        return 1
    fi

    local tmpfile="/tmp/pgdump-$$.sql.gz"
    log "Dumping ${POSTGRES_DB} to GCS..."
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
        --clean --if-exists --no-owner --no-privileges \
        | gzip > "${tmpfile}"

    gcloud storage cp "${tmpfile}" "${GCS_DUMP_PATH}" --quiet
    rm -f "${tmpfile}"
    log "Dump uploaded to ${GCS_DUMP_PATH} ($(du -h "${tmpfile}" 2>/dev/null || echo 'done'))"
}

# Periodic dump loop (runs in background)
periodic_dump() {
    log "Starting periodic dump every ${DUMP_INTERVAL_SECONDS}s"
    while true; do
        sleep "${DUMP_INTERVAL_SECONDS}"
        dump_to_gcs || true
    done
}

# Graceful shutdown: dump then stop Postgres
shutdown_handler() {
    log "SIGTERM received. Running final dump..."
    dump_to_gcs || log "Final dump failed (non-critical)"

    if [ -n "${PG_PID}" ]; then
        log "Stopping Postgres (PID ${PG_PID})..."
        kill -SIGTERM "${PG_PID}" 2>/dev/null || true
        wait "${PG_PID}" 2>/dev/null || true
    fi

    log "Shutdown complete."
    exit 0
}

trap shutdown_handler SIGTERM SIGINT

# Phase 1: Check GCS for existing dump before starting Postgres
HAS_DUMP=false
if download_dump; then
    HAS_DUMP=true
fi

# Phase 2: Start Postgres in background using official entrypoint
# If we have a GCS dump, skip init.sql (we'll restore from dump instead)
if [ "${HAS_DUMP}" = true ]; then
    # Move init scripts out of the way to prevent double-init
    mkdir -p /docker-entrypoint-initdb.d.bak
    mv /docker-entrypoint-initdb.d/* /docker-entrypoint-initdb.d.bak/ 2>/dev/null || true
fi

docker-entrypoint.sh postgres &
PG_PID=$!

# Phase 3: Wait for Postgres to be ready, then restore
log "Waiting for Postgres to start (PID ${PG_PID})..."
for i in $(seq 1 60); do
    if pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -q 2>/dev/null; then
        log "Postgres is ready."
        break
    fi
    sleep 1
done

if [ "${HAS_DUMP}" = true ]; then
    restore_dump
fi

# Phase 4: Start periodic dumps in background
periodic_dump &

# Phase 5: Wait for Postgres process
wait "${PG_PID}"
