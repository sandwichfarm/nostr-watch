import db from './db'

self.onmessage = async (event: MessageEvent) => {
  const {method, data} = event.data
  
}

const addToMonitorDb = async (data: Record<string, any>) => {
  try {
    await Promise.all([
      db.monitors.put(data.monitor),
    ]);
  } catch (err) {
    console.error('Failed to add mapped objects to DB:', err);
  }
}

// export default async ( dirtyData: MonitorDataDirty) => {
//   const transformedData = transform(dirtyData)
//   await addToMonitorDb( transformedData )
// }