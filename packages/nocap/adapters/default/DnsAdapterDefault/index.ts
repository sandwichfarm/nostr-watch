import fetch from 'cross-fetch';
import Nocap from "../../../src/classes/Base.ts";

interface DnsResponse {
    status: string;
    message?: string;
    data: any;
}

interface Answer {
    data: string;
}

interface JsonData {
    Answer: Answer[];
}

class DnsAdapterDefault {
    private $: Nocap; // This should be typed according to what 'parent' is expected to be

    constructor(parent: Nocap) {
        this.$ = parent;
    }

    async check_dns(): Promise<void> {
        let result: DnsResponse = { status: "error", data: {} };
        if (this.$.results.get('network') !== 'clearnet') {
            return this.$.logger.debug('DNS check skipped for url not accessible over clearnet');
        }

        let Url = new URL(this.$.url);
        let url = `${Url.protocol}//${Url.host}`.replace(/^(wss:\/\/|ws:\/\/)/, '').replace(/\/+$/, '');
        const query = `https://1.1.1.1/dns-query?name=${url}`;
        const headers = { accept: 'application/dns-json' };

        try {
            const response = await fetch(query, { headers });
            const data: JsonData = await response.json();
            data.ipv4 = getIpv4(data);
            data.ipv6 = getIpv6(data);
            if (!data?.Answer || data.Answer.length === 0 || Object.keys(data.Answer[0]).length === 0) {
                result = { status: "error", message: "No DNS Answer", data: {} };
            } else {
                result = { status: "success", data };
            }
        } catch (e) {
            result = { status: "error", message: e.message, data: {} };
        }

        this.$.finish('dns', result);
    }
}

const getIpv4 = (jsonData: JsonData): string[] | null => {
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return jsonData.Answer.filter(answer => ipv4Regex.test(answer.data)).map(answer => answer.data) || null;
};

const getIpv6 = (jsonData: JsonData): string[] | null => {
    const ipv6Regex = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])))\)$/;
    return jsonData.Answer.filter(answer => ipv6Regex.test(answer.data)).map(answer => answer.data) || null;
};

export default DnsAdapterDefault;
