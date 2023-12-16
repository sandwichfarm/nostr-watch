import CheckMeta from '../models/CheckMeta.js';
import InfoMeta from '../models/MetaInfo.js';
import DnsMeta from '../models/MetaDns.js';
import GeoMeta from '../models/MetaGeo.js';
import SslMeta from '../models/MetaSsl.js';

const associateCheckMetaWith = (Checkable) => {
  const alias = `checkable${Checkable.name}`;

  CheckMeta.belongsTo(Checkable, {
      foreignKey: 'meta_id',
      constraints: false,
      as: alias,
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
      as: `${alias}Metas`
  });
}


export default () => {
  associateCheckMetaWith(InfoMeta);
  associateCheckMetaWith(GeoMeta);
  associateCheckMetaWith(DnsMeta);
  associateCheckMetaWith(SslMeta);
}

