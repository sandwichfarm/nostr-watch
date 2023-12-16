import Sequelize from 'sequelize';
import { configure } from 'sequelize-pg-utilities'
import config from '../config/config.json' assert {type: 'json'};

const { name, user, password, options } = configure(config, "nostrwatch")

console.log(name, user, password, options)

const sequelize = () => new Sequelize(
  name,
  user,
  password,
  {
    // host: process.env.POSTGRES_HOST,
    // port: process.env.POSTGRES_PORT,
    // dialect: 'postgres',
    // logging: process.env.NODE_ENV === 'development',
    // define: {
    //   charset: 'utf8',
    //   dialectOptions: {
    //     collate: 'utf8_general_ci'
    //   }
    // },
    ...options
  }
);

export default sequelize;