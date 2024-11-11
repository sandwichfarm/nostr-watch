const version = 1;

const name = 'relay';

const schema = `
DEFINE TABLE relay SCHEMAFULL;

DEFINE FIELD id          ON relay TYPE string ASSERT $value != NONE;
DEFINE FIELD lastSeen    ON relay TYPE int;
DEFINE FIELD network     ON relay TYPE string;
DEFINE FIELD created_at  ON relay TYPE int;
DEFINE FIELD ignore      ON relay TYPE bool;
DEFINE FIELD score       ON relay TYPE int;
`;

const relationships = `
-- Relay has many checks (checks reference relay)
-- Optional: DEFINE FIELD checks ON relay TYPE array;
`;

const indices = `
DEFINE INDEX idx_relay_id        ON relay FIELDS id UNIQUE;
DEFINE INDEX idx_relay_lastSeen  ON relay FIELDS lastSeen;
DEFINE INDEX idx_relay_network   ON relay FIELDS network;
DEFINE INDEX idx_relay_ignore    ON relay FIELDS ignore;
`;

export default {
  version,
  name,
  schema,
  relationships,
  indices,
};
