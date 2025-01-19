import { nip11 } from "nostr-tools";
import type { Nip11ServiceMessage } from "./index.js";

const check = async (relay: string): Promise<nip11.RelayInformation> => {
    return nip11.fetchRelayInformation(relay)
}

const timeoutMessage = (relay: string) => {
    const error = `Request for NIP-11 from ${relay} timed out.`
    self.postMessage({ relay, error } as Nip11ServiceMessage)
}

self.onmessage = ({ data }) => {
    const { relay } = data;
    let timedOut:boolean = false
    const timeoutRequest = () => { 
        console.error('TIMED OUT')
        timedOut = true;
        timeoutMessage(relay) 
    }
    const timeout = setTimeout(timeoutRequest, 5000)
    check(relay)
        .then((nip11: nip11.RelayInformation) => {
            if(timedOut) return;
            clearTimeout(timeout)
            self.postMessage({ relay, nip11 } as Nip11ServiceMessage)
        })
        .catch((error: any) => { 
            if(timedOut) return;
            clearTimeout(timeout)
            self.postMessage({ relay, error } as Nip11ServiceMessage)
        })
}

self.onerror = (err: any) => {
    self.postMessage({ error: 'timed out.' } as Nip11ServiceMessage)
}