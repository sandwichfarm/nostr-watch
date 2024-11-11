import PQueue, { QueueAddOptions } from 'p-queue';

import { TransformEvent, transform30166, transform10166 } from '@nostrwatch/nip66/transform';
import { IEvent, IMonitor, IRelay, ICheck, INip11, IGeocode } from '@nostrwatch/nip66/models';

import RelayDb from './connect';

const queue: PQueue = new PQueue({concurrency: 1});

export const addEvent = async (event: IEvent): Promise<void | undefined> => {
    if(event.kind === 10166){
        await addRawCheck(event);
    }
    if(event.kind === 30166){
        await addRawCheck(event);
    }
}

export const addRawCheck = async (ev: IEvent): Promise<void | undefined> => {
    const { check, relay, nip11, event, geocodes } = await transform30166(ev);
    addEvent( event );
    addCheck( check, relay );
    addRelay( relay );
    addNip11( nip11, relay.pubkey );
    if(geocodes) addGeocodes( geocodes );
}

export const addRawMonitor = async(event: IEvent): Promise<void | undefined> => {
    const { monitor } = await transform10166(event);
    await addMonitor(monitor);
}

const addMonitor = async (monitor: IMonitor): Promise<string | void> => {
    return
}
const addMonitorQ = async (monitor: IMonitor, qOpts: QueueAddOptions = { priority: 1 }): Promise<string | void> => {
    return queue.add<string | void>( async () => addMonitor(monitor), qOpts )
}

const addCheck = async (check: ICheck, relay: IRelay): Promise<string | void>  => {
    return
}

const addCheckQ = async (check: ICheck, relay: IRelay, qOpts: QueueAddOptions = { priority: 1 }): Promise<string | void> => {
    return queue.add<string | void>( async () => addCheck(check, relay), qOpts)
}

const addRelay = async (relay: IRelay): Promise<void | undefined> => {}
const addGeocodes = async (geocodes: IGeocode[]): Promise<void | undefined> => {}
const addNip11 = async (nip11: INip11, monitorPubkey: string): Promise<void | undefined> => {}
const addSsl = async (ssl: INip11, monitorPubkey: string): Promise<void | undefined> => {}