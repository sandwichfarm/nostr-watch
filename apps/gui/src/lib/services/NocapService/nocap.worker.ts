import Nocap, { type CheckKey } from "@nostrwatch/nocap"
import WebsocketAdapterDefault from "@nostrwatch/nocap-websocket-adapter-default/web"
import InfoAdapterDefault from "@nostrwatch/nocap-info-adapter-default"
import DnsAdapterDefault from "@nostrwatch/nocap-dns-adapter-default"
import type { NocapRequestMessage, NocapResultMessage } from "./index.js";

const check = async (relay: string, checks: CheckKey[]): Promise<any> => {
    console.log('check')
    const nocap = new Nocap(relay)
    nocap.useAdapter(WebsocketAdapterDefault)
    nocap.useAdapter(InfoAdapterDefault)
    nocap.useAdapter(DnsAdapterDefault)
    return nocap.check(checks as CheckKey[])
}

self.onmessage = ({ data }) => {
    console.log('worker')
    const { relay, checks } = data as NocapRequestMessage;
    console.log('worker: checking:', relay, checks)
    check(relay, checks)
        .then( (results: any) => {
            const message: NocapResultMessage = { relay, results }
            console.log('message:', message)    
            self.postMessage(message)
        })
        .catch( (error: any) => {
            const message: NocapResultMessage = { relay, error }
            self.postMessage(message)
        })
}