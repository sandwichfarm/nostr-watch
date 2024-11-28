export class NocapService {
    private _worker?: Worker;

    constructor() {}

    get worker(): Worker | undefined {
        return this._worker;
    }

    private set worker(worker: Worker) {
        this._worker = worker;
    }

    async init(): Promise<void> {}
    
}