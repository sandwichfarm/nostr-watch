import { describe, it, expect } from 'vitest';
import { NocapRelayCheckInfo } from './NocapRelayCheckInfo';
import data from '../common/NocapRelayCheckInfoDataSample.js'

describe('NocapRelayCheckInfo', () => {
    it('should correctly initialize with default values', () => {
        const nocapInfo = new NocapRelayCheckInfo();

        expect(nocapInfo.url).toBe('');
        expect(nocapInfo.network).toBe('');
        expect(nocapInfo.adapters).toEqual([]);
        expect(nocapInfo.checked_at).toBe(-1);
        expect(nocapInfo.checked_by).toBe('');
        expect(nocapInfo.info).toBeNull();
    });

    it('should correctly initialize with provided values', () => {
        const nocapInfo = new NocapRelayCheckInfo(data);

        expect(nocapInfo.url).toBe(data.url);
        expect(nocapInfo.network).toBe(data.network);
        expect(nocapInfo.adapters).toEqual(data.adapters);
        expect(nocapInfo.checked_at).toBe(data.checked_at);
        expect(nocapInfo.checked_by).toBe(data.checked_by);
        expect(nocapInfo.info).toEqual(data.info);
    });

    // ... [previous test setup]

    it('should correctly transform to RdbRelayCheckInfo format', () => {

      const nocapInfo = new NocapRelayCheckInfo(data);
      const rdbInfo = nocapInfo.toRdb();

      // Verify the instance type
      expect(rdbInfo).toBeInstanceOf(RdbRelayCheckInfo);

      // Check basic properties
      expect(rdbInfo.checked_at).toBe(nocapData.checked_at);
      expect(rdbInfo.checked_by).toBe(nocapData.checked_by);
      expect(rdbInfo.adapters).toEqual(nocapData.adapters);

      // Verify nested data transformation
      expect(rdbInfo.data.name).toBe(nocapData.info.data.name);
      expect(rdbInfo.data.description).toBe(nocapData.info.data.description);
      expect(rdbInfo.data.pubkey).toBe(nocapData.info.data.pubkey);
      expect(rdbInfo.data.contact).toBe(nocapData.info.data.contact);
      expect(rdbInfo.data.software).toBe(nocapData.info.data.software);
      expect(rdbInfo.data.version).toBe(nocapData.info.data.version);
      expect(rdbInfo.data.payments_url).toBe(nocapData.info.data.payments_url);

      // Verify limitation mapping
      expect(rdbInfo.data.limitation.max_message_length).toBe(nocapData.info.data.limitation.max_message_length);
      expect(rdbInfo.data.limitation.auth_required).toBe(nocapData.info.data.limitation.auth_required);
      expect(rdbInfo.data.limitation.payment_required).toBe(nocapData.info.data.limitation.payment_required);
      
      // Verify fees mapping
      expect(rdbInfo.data.fees.admission).toEqual(nocapData.info.data.fees.admission);

      // Verify supported NIPs mapping
      expect(rdbInfo.data.supported_nips).toEqual(nocapData.info.data.supported_nips);
      expect(rdbInfo.data.supported_nip_extensions).toEqual(nocapData.info.data.supported_nip_extensions);

      // Check for dropped fields
      expect(rdbInfo.dropped_fields).toContain('url');
      expect(rdbInfo.dropped_fields).toContain('network');
      expect(rdbInfo.dropped_fields).toContain('info.status');
      // ... any other dropped fields
    });

});
