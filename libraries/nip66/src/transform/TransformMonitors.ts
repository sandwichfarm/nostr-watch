import { IEvent, IMonitor, modelDefaults } from '@models/index';
import { geocodeTransform, iGeocodeToArray } from './TransformRelays';

export type IdbReadyMonitorData = { 
  event?: IEvent;
  monitor?: IMonitor;
}

export const transform10166 = async (_event: IEvent): Promise<IdbReadyMonitorData> => {  
  const res: IdbReadyMonitorData = {}

  const eventRecord = k10166ToIEvent(_event)
  const parsedMonitor = n66IEventToIMonitor( eventRecord)

  if(eventRecord) res.event = eventRecord
  if(parsedMonitor) res.monitor = parsedMonitor

  return res
}

export const k10166ToIEvent = (_event: IEvent): IEvent => {
  const { pubkey, created_at, id, kind, tags, content, signature } = _event;
  const event: IEvent = {
    id,
    kind,
    pubkey,
    created_at,
    tags,
    content,
    signature
  }
  return event
}

export const n66IEventToIMonitor = (event: IEvent): IMonitor => {
  const { pubkey, id:eventId } = event;

  const frequency: number = getFrequency(event);
  const checks: string[] | null = getChecks(event)
  const geohash: string | null = getGeohash(event)
  const geocode = iGeocodeToArray(geocodeTransform(event))

  const monitor = { 
    pubkey,
    eventId,
    checks,
    frequency,
    geohash,
    geocode
  }

  return {...modelDefaults<IMonitor>(), ...monitor} as IMonitor
}

const getFrequency = (event: IEvent): number => {
  let f = -1
  try{
    const f_ = event.tags.find( tag => tag[0] === 'frequency' )?.[1];
    if(f_) f = parseInt(f_)
  }
  catch(e){
    console.warn(`frequency did not validate for monitor: ${event.pubkey}`)
  }
  return f;
}

const getGeohash = (event: IEvent): string | null => {
  return event.tags.reduce((longest, t) => {
    const key = t[0];
    const value = t[1];
    const isGeohash = key === 'g';

    if (isGeohash && value.length > (longest?.length || 0)) {
      return value;
    }

    return longest;
  }, null as string | null);
};

const getChecks = (event: IEvent): string[] | null => {
  const checks = event.tags.reduce( (acc, t) => {
    const key = t[0];
    const value = t[1];
    const isCheck = key === 'c';
    if(isCheck) acc.push(value)
    return acc
  }, [] as string[] );
  return checks ?? null
}

export default transform10166;