import Nocap, { type CheckKey } from "@nostrwatch/nocap"
import WebsocketAdapterDefault from "@nostrwatch/nocap-websocket-adapter-default/web-worker"
import InfoAdapterDefault from "@nostrwatch/nocap-info-adapter-default"
import DnsAdapterDefault from "@nostrwatch/nocap-dns-adapter-default"
import type { NocapRequestMessage, NocapResultMessage } from "./index.js";

// const global = self.global as any

const check = async (relay: string, checks: CheckKey[]): Promise<any> => {
    const nocap = new Nocap(relay)
    nocap.useAdapter(WebsocketAdapterDefault)
    nocap.useAdapter(InfoAdapterDefault)
    nocap.useAdapter(DnsAdapterDefault)
    return nocap.check(checks as CheckKey[])
}

self.onmessage = ({ data }) => {
    const { relay, checks } = data as NocapRequestMessage;
    check(relay, checks)
        .then( (results: any) => {
            const message: NocapResultMessage = { relay, results }
            // console.log('message:', message)    
            self.postMessage(message)
        })
        .catch( (error: any) => {
            const message: NocapResultMessage = { relay, error }
            self.postMessage(message)
        })
}