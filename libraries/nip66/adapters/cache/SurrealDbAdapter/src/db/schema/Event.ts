const version = 1;

const name = 'event';

const schema = `
DEFINE TABLE event SCHEMAFULL;

DEFINE FIELD id           ON event TYPE string ASSERT $value != NONE;
DEFINE FIELD pubkey       ON event TYPE string;
DEFINE FIELD kind         ON event TYPE int;
DEFINE FIELD tags         ON event TYPE array;
DEFINE FIELD content      ON event TYPE string;
DEFINE FIELD signature    ON event TYPE string;
DEFINE FIELD created_at   ON event TYPE int;
`;

const relationships = `
-- No explicit relationships defined for event
`;

const indices = `
DEFINE INDEX idx_event_id         ON event FIELDS id UNIQUE;
DEFINE INDEX idx_event_pubkey     ON event FIELDS pubkey;
DEFINE INDEX idx_event_kind       ON event FIELDS kind;
DEFINE INDEX idx_event_created_at ON event FIELDS created_at;
`;

export default {
  version,
  name,
  schema,
  relationships,
  indices,
};
