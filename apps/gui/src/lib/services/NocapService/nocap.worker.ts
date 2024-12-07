import Nocap from "@nostrwatch/nocap"
import type { NocapRequestMessage, NocapResultMessage } from "./index.js";

const check = async (relay: string, checks: string[]): Promise<any> => {
    const nocap = new Nocap(relay)
    return nocap.check(checks)
}

self.onmessage = ({ data }) => {
    const { relay, checks } = data as NocapRequestMessage;
    check(relay, checks)
        .then( (results: any) => {
            const message: NocapResultMessage = {relay, results}
            self.postMessage(message)
        })
        .catch( (error: any) => {
            const message: NocapResultMessage = {relay, error}
            self.postMessage(message)
        })
}