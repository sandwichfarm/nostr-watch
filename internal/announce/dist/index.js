import chalk from 'chalk';
import { verifyEvent } from "nostr-tools";
import { Publisher, Kind10166, Kind0, Kind10002 } from "@nostrwatch/publisher";
import Logger from "@nostrwatch/logger";
const log = new Logger('@nostrwatch/announce');
const NIP66_MONITOR_REGISTER = 10166;
export class AnnounceMonitor {
    events = {};
    monReg;
    monRelays = [];
    monProfile;
    publisher;
    pubkey = null;
    constructor(options, pubkey) {
        log.debug(`announce::constructor(): ${pubkey}`);
        this.setup(options);
        this.pubkey = pubkey;
        this.publisher = new Publisher(pubkey, this.monRelays);
    }
    setup(options) {
        const { geo = {}, kinds = [], timeouts = {}, networks = {}, checks = [], owner = '', frequency = '', profile = {}, relays = [], } = options;
        this.monReg = {};
        if (!(geo instanceof Object))
            throw new Error("geo must be object");
        if (!(timeouts instanceof Object))
            throw new Error("timeouts must be object");
        if (!(kinds instanceof Array))
            throw new Error("kinds must be array");
        if (!(checks instanceof Array))
            throw new Error("checks must be array");
        if (!(networks instanceof Array))
            throw new Error("checks must be array");
        if (typeof owner !== "string")
            throw new Error("owner must be string");
        if (typeof frequency !== "string")
            throw new Error("frequency must be string");
        if (!(relays instanceof Array))
            throw new Error("relays must be an array");
        if (!(profile instanceof Object))
            throw new Error("profile must be an object");
        this.monReg.geo = geo;
        this.monReg.kinds = kinds;
        this.monReg.timeouts = timeouts;
        this.monReg.owner = owner;
        this.monReg.frequency = frequency;
        this.monReg.networks = networks;
        this.monReg.checks = AnnounceMonitor.formatChecks(checks);
        this.monRelays = relays;
        this.monProfile = profile;
    }
    static formatChecks(checks) {
        if (checks.includes('all'))
            return ['websocket', 'ws', 'info', 'dns', 'geo', 'ssl'];
        return checks;
    }
    generate() {
        log.debug(`announce::generate(): ${this.pubkey}`);
        const $monReg = new Kind10166(this.pubkey);
        $monReg.generateEvent({ ...$monReg });
        this.events["10166"] = $monReg;
        const $monRelays = new Kind10002(this.pubkey);
        if (this.monRelays.length) {
            $monRelays.generateEvent([...this.monRelays]);
            this.events["10002"] = $monRelays;
        }
        const $monProfile = new Kind0(this.pubkey);
        if (Object.keys(this.monProfile).length) {
            $monProfile.generateEvent({ ...this.monProfile });
            this.events["0"] = $monProfile;
        }
        return this.events;
    }
    sign(sk) {
        if (!this.events)
            throw new Error("Event has not yet been generated (run generate() first)");
        Object.values(this.events).forEach((event) => {
            this.events[event.kind] = event.signEvent();
        });
    }
    async publish() {
        if (!this.events)
            throw new Error("Event has not yet been generated");
        const pubbedIds = [];
        const kinds = Object.keys(this.events);
        for (let i = 0; i < kinds.length; i++) {
            const kind = kinds[i];
            try {
                await Promise.any(this.publisher.publishEvent(this.events[kind]));
            }
            catch (e) {
                log.error(`${chalk.red.bold(kind)} ${chalk.gray.italic('failed to publish to')} ${chalk.white.bold(this.monRelays.join(','))}`);
            }
            log.info(`${chalk.yellow.bold(kind)} ${chalk.gray.italic('published to')} ${chalk.white.bold(this.monRelays.join(','))}`);
            pubbedIds.push(this.events[kind].id);
        }
        return pubbedIds;
    }
    static verify(ev) {
        return verifyEvent(ev);
    }
}
