const version = 1;

const name = 'nip11';

const schema = `
DEFINE TABLE nip11 SCHEMAFULL;

DEFINE FIELD relay         ON nip11 TYPE string ASSERT $value != NONE;
DEFINE FIELD monitorPubkey ON nip11 TYPE record(monitor);
DEFINE FIELD hash          ON nip11 TYPE string;
DEFINE FIELD nid           ON nip11 TYPE string;
DEFINE FIELD created_at    ON nip11 TYPE int;
DEFINE FIELD json          ON nip11 TYPE object;
`;

const relationships = ``;

const indices = `
DEFINE INDEX idx_nip11_relay         ON nip11 FIELDS relay;
DEFINE INDEX idx_nip11_monitorPubkey ON nip11 FIELDS monitorPubkey;
DEFINE INDEX idx_nip11_created_at    ON nip11 FIELDS created_at;
`;

export default {
  version,
  name,
  schema,
  relationships,
  indices,
};
