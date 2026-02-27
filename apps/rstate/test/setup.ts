// Vitest setup — set env vars before any imports trigger loadConfig()
process.env.CVM_ENABLED = 'false'
process.env.REST_ENABLED = 'true'
process.env.INGEST_RELAYS = 'ws://localhost:6969'
process.env.LOG_ENABLED = 'false'
