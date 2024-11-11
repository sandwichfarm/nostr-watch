import Surreal from 'surrealdb';

const version = 1

const name = "Checks"

const schema =`
-- Primary Key (Using nid as the unique identifier)
DEFINE FIELD event               ON check TYPE string ASSERT $value != NONE;
DEFINE INDEX idx_check_event     ON check FIELDS event UNIQUE;

-- Base Fields
DEFINE FIELD relay            ON check TYPE record(relay) ASSERT $value != NONE;
DEFINE FIELD monitorPubkey    ON check TYPE record(monitor) ASSERT $value != NONE;
DEFINE FIELD created_at       ON check TYPE int ASSERT $value != NONE;

-- Meta Fields
DEFINE FIELD network          ON check TYPE string;
DEFINE FIELD rtt              ON check TYPE int;

DEFINE FIELD operatorPubkey   ON check TYPE string;
DEFINE FIELD supportedNips    ON check TYPE array;
DEFINE FIELD software         ON check TYPE string;
DEFINE FIELD version          ON check TYPE string;

DEFINE FIELD paymentRequired  ON check TYPE bool;
DEFINE FIELD authRequired     ON check TYPE bool;
DEFINE FIELD powRequired      ON check TYPE int;

DEFINE FIELD geohash          ON check TYPE array;
DEFINE FIELD geocode          ON check TYPE array;

DEFINE FIELD isp              ON check TYPE string;
DEFINE FIELD as               ON check TYPE string;
DEFINE FIELD asname           ON check TYPE string;

DEFINE FIELD ipv4             ON check TYPE array;
DEFINE FIELD ipv6             ON check TYPE array;

DEFINE FIELD sslValidTo       ON check TYPE int;
DEFINE FIELD sslIssuer        ON check TYPE string;
`

const relationships = ``

const indices = `
-- Unique Index on 'event  ' (event)
DEFINE INDEX idx_check_event          ON check FIELDS event UNIQUE;

-- Index on 'relay' field
DEFINE INDEX idx_check_relay          ON check FIELDS relay;

-- Index on 'monitorPubkey' field
DEFINE INDEX idx_check_monitorPubkey  ON check FIELDS monitorPubkey;

-- Index on 'created_at' for temporal queries
DEFINE INDEX idx_check_created_at     ON check FIELDS created_at;

-- Index on 'network' for filtering
DEFINE INDEX idx_check_network        ON check FIELDS network;

-- Index on 'operatorPubkey' for queries related to operators
DEFINE INDEX idx_check_operatorPubkey ON check FIELDS operatorPubkey;

-- Index on 'geohash' for spatial queries
DEFINE INDEX idx_check_geohash        ON check FIELDS geohash;

-- Index on 'geocode' for location-based queries
DEFINE INDEX idx_check_geocode        ON check FIELDS geocode;

DEFINE INDEX idx_check_software       ON check FIELDS software;
DEFINE INDEX idx_check_version        on CHECK FIELDS version
`

export default {
    version,
    name,
    schema,
    relationships,
    indices
}