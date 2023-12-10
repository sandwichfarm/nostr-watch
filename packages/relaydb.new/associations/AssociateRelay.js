import { Relay, RelayIp, CheckMeta, CheckStatus, Info, Dns, Geo, Ssl } from './models/index.js';


//Checks 
CheckMeta.belongsTo(Relay, { foreignKey: 'relay_id' });
Relay.hasMany(CheckMeta, { foreignKey: 'relay_id' });

CheckStatus.belongsTo(Relay, { foreignKey:'relay_id' });
Relay.hasMany(CheckStatus, { foreignKey:'relay_id' });

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
RelayIp.belongsTo(Relay, { foreignKey: 'relay_id' });
Relay.hasMany(RelayIp, { foreignKey: 'relay_id' });