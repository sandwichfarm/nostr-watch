import { NWDPlugin } from './NWDPlugin';
import { IdentityService } from '../services/IdentityService';
import { PluginService } from '../services/PluginService';

class SyncBase extends NWDPlugin {
  constructor($PluginService: PluginService, $IdentityService: IdentityService )  {
    super($PluginService, $IdentityService)
  }
}