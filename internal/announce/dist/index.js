import chalk from 'chalk';
import { verifyEvent } from "nostr-tools";
import { Publisher, Kind10166, Kind0, Kind10002 } from "@nostrwatch/publisher";
import Logger from "@nostrwatch/logger";
const log = new Logger('@nostrwatch/announce');
export class AnnounceMonitor {
    events = {};
    monReg;
    monRelays = [];
    userDataRelays = [];
    monProfile;
    nip66Publisher;
    userMetaPublisher;
    pubkey = null;
    constructor(pubkey, options) {
        log.debug(`announce::constructor(): ${pubkey}`);
        this.setup(options);
        this.pubkey = pubkey;
        this.nip66Publisher = new Publisher(pubkey, this.monRelays);
        this.userMetaPublisher = new Publisher(pubkey, this.userDataRelays);
    }
    setup(options) {
        const { geo = {}, kinds = [], timeouts = {}, networks = {}, checks = [], owner = '', frequency = '', profile = {}, relays = [], } = options;
        const userDataRelays = options.userDataRelays || ['wss://purplepag.es', 'wss://user.kindpag.es'];
        this.monReg = {};
        if (typeof frequency !== "string")
            throw new Error("frequency must be string");
        if (!(userDataRelays instanceof Array))
            throw new Error("userDataRelays must be an array");
        if (!(relays instanceof Array))
            throw new Error("relays must be an array");
        if (!relays.length)
            throw new Error("monitor publish relays must not be empty");
        if (geo && !(geo instanceof Object))
            throw new Error("geo must be object");
        if (timeouts && !(timeouts instanceof Object))
            throw new Error("timeouts must be object");
        if (kinds && !(kinds instanceof Array))
            throw new Error("kinds must be array");
        if (checks && !(checks instanceof Array))
            throw new Error("checks must be array");
        if (networks && !(networks instanceof Array))
            throw new Error("checks must be array");
        if (owner && typeof owner !== "string")
            throw new Error("owner must be string");
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
        $monReg.generateEvent({ ...this.monReg });
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
        const kinds = Object.keys(this.events).map(Number);
        for (let i = 0; i < kinds.length; i++) {
            const kind = kinds[i];
            if (kind === 0 || kind === 10002) {
                await Promise.any(this.userMetaPublisher.publishEvent(this.events[kind.toString()]));
            }
            try {
                await Promise.any(this.nip66Publisher.publishEvent(this.events[kind.toString()]));
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
