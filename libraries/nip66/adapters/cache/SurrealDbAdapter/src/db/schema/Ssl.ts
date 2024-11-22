const version = 1;

const name = 'ssl';

const schema = `
DEFINE TABLE ssl SCHEMAFULL;

DEFINE FIELD nid           ON ssl TYPE string ASSERT $value != NONE;
DEFINE FIELD relay         ON ssl TYPE record(relay);
DEFINE FIELD created_at    ON ssl TYPE int;
DEFINE FIELD monitorPubkey ON ssl TYPE record(monitor);
DEFINE FIELD hash          ON ssl TYPE string;
DEFINE FIELD cert          ON ssl TYPE string;
`;

const relationships = ``;

const indices = `
DEFINE INDEX idx_ssl_nid           ON ssl FIELDS nid UNIQUE;
DEFINE INDEX idx_ssl_relay         ON ssl FIELDS relay;
DEFINE INDEX idx_ssl_monitorPubkey ON ssl FIELDS monitorPubkey;
DEFINE INDEX idx_ssl_created_at    ON ssl FIELDS created_at;
`;

export default {
  version,
  name,
  schema,
  relationships,
  indices,
};
