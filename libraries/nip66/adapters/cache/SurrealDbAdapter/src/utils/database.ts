import eventModel from '../db/schema/Event';
import geocodeModel from '../db/schema/Geocode';
import monitorModel from '../db/schema/Monitor';
import nip11Model from '../db/schema/Nip11';
import relayModel from '../db/schema/Relay';
import sslModel from '../db/schema/Ssl';
import checkModel from '../db/schema/Check';
import Surreal, { AnyAuth, QueryResult } from 'surrealdb';

const models = [
  eventModel,
  geocodeModel,
  monitorModel,
  nip11Model,
  relayModel,
  sslModel,
  checkModel,
];

export interface IndexInfo {
  name: string;
}

export interface TableInfo {
  indexes: IndexInfo[]; 
}

export async function initDb(db: Surreal, namespace: string, database: string) {

  try {
    console.log('Initializing the database');

    await db.use({namespace, database})

    for (const model of models) {
      await createTableSchema(db, model);
    }

    for (const model of models) {
      await defineRelationships(db, model);
    }

    for (const model of models) {
      await defineIndices(db, model);
    }

    console.log('All models have been set up successfully!');
  } catch (e) {
    console.error('Failed to initialize the database:', e);
  }
}

async function createTableSchema(db: Surreal, model: any) {
  const { name, version, schema } = model;

  const tableExists = await checkTableExists(db, name);

  if (!tableExists) {
    console.log(`Creating table schema for ${name}`);
    await db.query(`
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

async function defineRelationships(db: Surreal, model: any) {
  const { name, relationships } = model;

  if (relationships.trim()) {
    console.log(`Defining relationships for ${name}`);
    await db.query(relationships);
  }
}

async function defineIndices(db: Surreal, model: { name: string; indices: string }) {
  const { name, indices } = model;

  if (!indices.trim()) {
    return;
  }

  try {
    const existingIndexesResult = (await db.query(`INFO FOR TABLE ${name}`)) as any[];
    const firstResult = existingIndexesResult[0];
    const existingIndexes = Object.values(firstResult.indexes) || [];
    const indexDefinitions = indices.split('\n').filter((index: string) => {
      const match = index.match(/DEFINE INDEX (\w+) ON/);
      return match && !existingIndexes.includes(match[1]);
    });

    for (const index of indexDefinitions) {
      console.log(`Defining index: ${index}`);
      await db.query(index);
    }
  } catch (error: any) {
    if (error?.message && error?.message.includes("already exists")) {
      console.log(`Index already exists for table ${name}. Skipping index creation.`);
    } else {
      console.error(`Failed to define indices for table ${name}:`, error);
    }
  }
}

async function checkTableExists(db: Surreal, tableName: string): Promise<boolean> {
  try {
    const result = await db.query(`INFO FOR TABLE ${tableName}`);
    return result.length > 0;
  } catch (e) {
    return false;
  }
}

