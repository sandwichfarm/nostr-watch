import { makeInitialiser } from 'sequelize-pg-utilities'
import config from './config/config.json' assert {type: 'json'};

const init = makeInitialiser(config)

const start = async () => {
  try {
    const result = await initialise()
    console.log(result.message)

    // now do whatever else is needed to start your server
  } catch (err) {
    console.error('Could not start server', err)
    process.exit(1)
  }
}

export default init