const version = 1;

const name = 'geocode';

const schema = `
DEFINE TABLE geocode SCHEMAFULL;

DEFINE FIELD code   ON geocode TYPE string ASSERT $value != NONE;
DEFINE FIELD type   ON geocode TYPE string;
DEFINE FIELD format ON geocode TYPE string;
DEFINE FIELD length ON geocode TYPE int;
`;

const relationships = `
-- No explicit relationships defined for geocode
`;

const indices = `
DEFINE INDEX idx_geocode_code   ON geocode FIELDS code UNIQUE;
DEFINE INDEX idx_geocode_type   ON geocode FIELDS type;
DEFINE INDEX idx_geocode_format ON geocode FIELDS format;
`;

export default {
  version,
  name,
  schema,
  relationships,
  indices,
};
