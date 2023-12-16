import run from "./daemon/index.js"

const $worker = await run()

// $worker.on('completed', job => console.log(job, 'completed'))