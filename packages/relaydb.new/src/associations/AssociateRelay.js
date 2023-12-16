import { Relay, Relayip, Checkmeta, Checkstatus, Info, Dns, Geo, Ssl } from '../models/index.js';

export default () => {
  //Checks 
  Checkmeta.belongsTo(Relay, { foreignKey: 'relay_id' });
  Relay.hasMany(Checkmeta, { foreignKey: 'relay_id' });

  Relay.belongsTo(Relay, { foreignKey: 'parent_id' });
  Relay.hasOne(Relay, { foreignKey: 'parent_id' });

  Checkstatus.belongsTo(Relay, { foreignKey:'relay_id' });
  Relay.hasMany(Checkstatus, { foreignKey:'relay_id' });

  //Meta
  Info.belongsTo(Relay, { foreignKey:'relay_id' });
  Relay.hasMany(Info, { foreignKey:'relay_id' });

  Dns.belongsTo(Relay, { foreignKey:'relay_id' });
  Relay.hasMany(Dns, { foreignKey:'relay_id' });

  Geo.belongsTo(Relay, { foreignKey:'relay_id' });
  Relay.hasMany(Geo, { foreignKey:'relay_id' });

  Ssl.belongsTo(Relay, { foreignKey:'relay_id' });
  Relay.hasMany(Ssl, { foreignKey:'relay_id' });

  // Join Tables 
  Relayip.belongsTo(Relay, { foreignKey: 'relay_id' });
  Relay.hasMany(Relayip, { foreignKey: 'relay_id' });
}

