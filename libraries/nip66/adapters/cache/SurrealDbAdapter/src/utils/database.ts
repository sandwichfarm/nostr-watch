import eventModel from '../db/schema/Event';
import geocodeModel from '../db/schema/Geocode';
import monitorModel from '../db/schema/Monitor';
import nip11Model from '../db/schema/Nip11';
import relayModel from '../db/schema/Relay';
import sslModel from '../db/schema/Ssl';
import checkModel from '../db/schema/Check';
import Surreal, { AnyAuth } from 'surrealdb';

const models = [
  eventModel,
  geocodeModel,
  monitorModel,
  nip11Model,
  relayModel,
  sslModel,
  checkModel,
];

export async function initDb(RelayDb: Surreal, namespace: string, database: string) {

  try {
    console.log('Initializing the database');

    console.log(`Connecting to SurrealDb with namespace ${namespace} and database ${database}`);

    await RelayDb.use({namespace, database})

    // const token = await RelayDb.signin({
    //   scope: 'admin',
    //   user: 'root',
    //   pass: 'root',
    // } as AnyAuth);

    // console.log('Signed in with token:', token);

    for (const model of models) {
      await createTableSchema(RelayDb, model);
    }

    for (const model of models) {
      await defineRelationships(RelayDb, model);
    }

    for (const model of models) {
      await defineIndices(RelayDb, model);
    }

    console.log('All models have been set up successfully!');
  } catch (e) {
    console.error('Failed to initialize the database:', e);
  }
}

async function createTableSchema(RelayDb: Surreal, model: any) {
  const { name, version, schema } = model;

  const tableExists = await checkTableExists(RelayDb, name);

  if (!tableExists) {
    console.log(`Creating table schema for ${name}`);
    await RelayDb.query(`
      ${schema}

      -- Store the schema version
      DEFINE TABLE ${name}_schema_version SCHEMALESS;
      DEFINE FIELD version ON ${name}_schema_version TYPE int;
      -- Insert the version record
      INSERT INTO ${name}_schema_version (version) VALUES (${version});
    `);
  } else {
    console.log(`Table ${name} already exists.`);
  }
}

async function defineRelationships(RelayDb: Surreal, model: any) {
  const { name, relationships } = model;

  if (relationships.trim()) {
    console.log(`Defining relationships for ${name}`);
    await RelayDb.query(relationships);
  }
}

async function defineIndices(RelayDb: Surreal, model: any) {
  const { name, indices } = model;

  if (indices.trim()) {
    console.log(`Defining indices for ${name}`);
    await RelayDb.query(indices);
  }
}

async function checkTableExists(RelayDb: Surreal, tableName: string): Promise<boolean> {
  try {
    const result = await RelayDb.query(`INFO FOR TABLE ${tableName}`);
    return result.length > 0;
  } catch (e) {
    return false;
  }
}

