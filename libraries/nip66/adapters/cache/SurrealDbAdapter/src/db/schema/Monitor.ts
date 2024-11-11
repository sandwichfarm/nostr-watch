const version = 1;

const name = 'monitor';

const schema = `
DEFINE TABLE monitor SCHEMAFULL;

DEFINE FIELD id          ON monitor TYPE string ASSERT $value != NONE;
DEFINE FIELD eventId     ON monitor TYPE string;
DEFINE FIELD frequency   ON monitor TYPE int;
DEFINE FIELD lastActive  ON monitor TYPE int;
DEFINE FIELD geohash     ON monitor TYPE string;
DEFINE FIELD geocode     ON monitor TYPE array;
`;

const relationships = `
-- Monitor has many events (events can reference monitor)
-- Optional: DEFINE FIELD events ON monitor TYPE array;
`;

const indices = `
DEFINE INDEX idx_monitor_id         ON monitor FIELDS id UNIQUE;
DEFINE INDEX idx_monitor_eventId    ON monitor FIELDS eventId;
DEFINE INDEX idx_monitor_lastActive ON monitor FIELDS lastActive;
DEFINE INDEX idx_monitor_geohash    ON monitor FIELDS geohash;
`;

export default {
  version,
  name,
  schema,
  relationships,
  indices,
};
