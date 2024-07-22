import db from './db'

const addToRelayDb = async (data: Record<string, any>) => {
  try {
    await Promise.all([
      db.relays.put(data?.relay || {}),
      // db.relayChecks.put(data.relayChecks || {}),
      // db.nip11s.put(data.nip11 || {}),
      // db.ssls.put(data.ssl || {})
    ]);
  } catch (err) {
    console.error('Failed to add mapped objects to DB:', err);
  }
}

export default async ( jobData: Record<string, any> ) => {
  await addToRelayDb( jobData )
}