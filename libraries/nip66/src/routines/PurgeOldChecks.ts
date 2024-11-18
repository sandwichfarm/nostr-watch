import { Routine } from "@base/core/Routine";

export class PurgeOldChecks extends Routine {
    constructor() {
        super();
    }
    async run() {
        console.log('PurgeOldChecks');
    }
}