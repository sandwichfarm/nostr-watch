declare const __WORKER_PATH: string;
declare const __BUILD_ID: string;

declare module "worker:*" {
    const inlineWorker: string;
    export default inlineWorker;
}

// declare module "*.worker.js" {
//     const inlineWorker: string;
//     export default inlineWorker;
// }