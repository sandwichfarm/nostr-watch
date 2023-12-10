import CheckMeta from './models/CheckMeta';
import InfoMeta from './models/InfoMeta';
import DnsMeta from './models/DnsMeta';
import GeoMeta from './models/GeoMeta';
import SslMeta from './models/SslMeta';

const associateCheckMetaWith = (Checkable) => {
  CheckMeta.belongsTo(Checkable, {
      foreignKey: 'meta_id',
      constraints: false,
      as: 'checkable',
      scope: {
          meta_type: Checkable.name
      }
  });
  Checkable.hasMany(CheckMeta, {
      foreignKey: 'meta_id',
      constraints: false,
      scope: {
        meta_type: Checkable.name
      },
      as: 'checkMetas'
  });
}

// Set up the associations
associateCheckMetaWith(InfoMeta);
associateCheckMetaWith(GeoMeta);
associateCheckMetaWith(DnsMeta);
associateCheckMetaWith(SslMeta);