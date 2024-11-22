import type { 
    CheckResult,
    CheckResultKeys, 
    ChecksResult, 
    GeohashOptions, 
    GetCheckParameters, 
    GetChecksParameters, 
    GetMonitorParameters, 
    GetMonitorsParameters, 
    GetRelaysParameters, 
    MonitorResult, 
    MonitorResultKeys, 
    MonitorsResult, 
    RelayResult, 
    RelayResultKeys, 
    RelaysResult
} from "@nostrwatch/nip66/core"

import type { ICheck, IEvent, IMonitor, IRelay } from "@nostrwatch/nip66/models"

const defaultEvent: IEvent = {
    id: '',
    pubkey: "",
    signature: '',
    content: '',
    tags: [],
    kind: 0,
    created_at: 0
}

export class SurrealDbMethods {
    async addEvent(event: IEvent): Promise<void> { 
    // return new Promise(async (resolve, reject) => {
    //   return void 0;
    // })
    }

    async addEvents(events: IEvent[]): Promise<void> { 
        // for(const event of events){
        //     await this.addEvent(event)
        // }
    }

    async putEvent(event: IEvent): Promise<void> { 
        return 
    }

    // R
    async getEvent(id: string): Promise<IEvent | null> { return null }
    async eventExists?(id: string): Promise<boolean> { return false }

    // U 

    // Events are immutable, no updates
    // D
    async deleteEvent(id: string): Promise<void> { return }
    async clearEvents(): Promise<void> { return }

    /* end: EVENTS */

    /***********
     * 
     * MONITORS
     * 
     */

    // C 
    async addMonitor(monitor: IEvent): Promise<void> { return }
    async putMonitor(monitor: IEvent): Promise<void> { return }

    // R
    async getMonitor(params: GetMonitorParameters, resultKeys: MonitorResultKeys): Promise<MonitorResult | null> { return null }
    async getMonitorRecord?(params: GetMonitorParameters): Promise<IMonitor> { return {} as IMonitor }
    async getMonitorRegistration?(params: GetMonitorParameters): Promise<IEvent> { return {} as IEvent }
    async getMonitorProfile?(params: GetMonitorParameters): Promise<IEvent> { return {} as IEvent }
    async getMonitorRelayList?(params: GetMonitorParameters): Promise<IEvent> { return {} as IEvent }
    async getMonitors(params: GetMonitorsParameters, resultKeys: MonitorResultKeys): Promise<MonitorsResult> { return {} as MonitorsResult }
    async getMonitorsRecords?(params: GetMonitorsParameters): Promise<IMonitor[]> { return [{}] as IMonitor[] }
    async getMonitorsRegistrations?(params: GetMonitorsParameters): Promise<IEvent[]> { return [{}] as IEvent[] }
    async getMonitorsProfiles?(params: GetMonitorsParameters): Promise<IEvent[]> { return [{}] as IEvent[] }
    async getMonitorsRelayLists?(params: GetMonitorsParameters): Promise<IEvent[]> { return [{}] as IEvent[] }
    //
    async getMonitorsByChecks?(checks: string[]): Promise<IEvent[]> { return [{}] as IEvent[] }
    async getMonitorsByDistance?(targetGeohash: string, options: GeohashOptions): Promise<IEvent[]> { return [{}] as IEvent[] }
    async getMonitorsByFrequency?(frequency: number, operator: ">" | "<"): Promise<IEvent[]> { return [{}] as IEvent[] }
    async ensureMonitorExists?(id: string): Promise<boolean> { return false }
    async ensureMonitorActive?(id: string): Promise<boolean> { return false }

    // U
    async patchMonitor?(monitor: Partial<IMonitor>): Promise<void> { return }
    async updateMonitor?(monitor: IMonitor): Promise<void> { return } //alias for putMonitor

    // D
    async deleteMonitor(id: string): Promise<void> { return }
    async deleteMonitors(ids: string[]): Promise<void> { return }
    async clearMonitors(): Promise<void> { return }

    /* end: MONITORS */

    /***********
     * 
     * RELAYS
     * 
     */

    // C
    async addRelay(relay: IRelay): Promise<void> { return }
    async putRelay(relay: IRelay): Promise<void> { return }

    // R
    //methods
    async getRelay(relay: string, resultKeys: RelayResultKeys): Promise<RelayResult | null> { return [] as RelayResult }
    async getRelayRecord?(relay: string, resultKeys: RelayResultKeys): Promise<IRelay> { return {} as IRelay }
    async getRelayCheckRecords?(relay: string, resultKeys: RelayResultKeys): Promise<ICheck[]> { return [{}] as ICheck[] }
    async getRelayCheckEvents?(relay: string, resultKeys: RelayResultKeys): Promise<IEvent[]>
    async getRelays(params: GetRelaysParameters, resultKeys: RelayResultKeys): Promise<RelaysResult> { return {} as RelaysResult }
    async getRelaysRecords?(params: GetRelaysParameters): Promise<IRelay[]> { return [{}] as IRelay[] }
    async getRelaysCheckRecords?(params: GetRelaysParameters): Promise<ICheck[][]> { return [[{}]] as ICheck[][] }
    async getRelaysCheckEvents?(params: GetRelaysParameters): Promise<IEvent[][]> { return [[{}]] as IEvent[][] }

    // U
    async patchRelay?(relay: Partial<IRelay>): Promise<void> { return }
    async updateRelay?(relay: IRelay): Promise<void> { return } //alias for patchRelay

    // D
    async deleteRelay(id: string): Promise<void> { return }
    async deleteRelays(relays: string[]): Promise<void> { return }
    async clearRelays(): Promise<void> { return }

    /* end: RELAYS */

    /***********
     * 
     * CHECKS
     * 
     */

    // C  
    async addCheck(check: IEvent): Promise<void> { return }
    async putCheck(check: IEvent): Promise<void> { return }

    // R
    async getCheck(checkParameters: GetCheckParameters, resultKeys: CheckResultKeys): Promise<CheckResult | null> { return null }
    async getCheckRecord?(checkParameters: GetCheckParameters): Promise<ICheck> { return {} as ICheck }
    async getCheckEvent?(checkParameters: GetCheckParameters): Promise<IEvent> { return {} as IEvent }
    async getChecks(checksParameters: GetChecksParameters, resultKeys: CheckResultKeys): Promise<ChecksResult> { return {} as ChecksResult }
    async getChecksRecords?(checksParameters: GetChecksParameters): Promise<ICheck[]> { return [{}] as ICheck[] }
    async getChecksEvents?(checksParameters: GetChecksParameters): Promise<IEvent[]> { return[defaultEvent] }

    // U
    //Checks don't have updates, they are immutable

    // D
    async deleteCheck(checkParameters: GetCheckParameters): Promise<void> { return }
    async deleteChecks(checksParameters: GetChecksParameters): Promise<void> { return }
    async clearChecks(): Promise<void> { return }
}

