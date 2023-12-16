import { describe, it, expect } from 'vitest';
import { BaseRelayCheckInfo } from './BaseRelayCheckInfo';

describe('BaseRelayCheckInfo', () => {
    it('should correctly initialize default properties', () => {
        const baseInfo = new BaseRelayCheckInfo();

        expect(baseInfo.relay_id).toBe('');
        expect(baseInfo.checked_at).toBe(-1);
        expect(baseInfo.checked_by).toBe('');
        expect(baseInfo.adapters).toBeNull();
        expect(baseInfo.dropped_fields).toEqual([]);
    });
    it('should correctly identify extra fields', () => {
        const baseInfo = new BaseRelayCheckInfo();
        const extraFields = baseInfo.getExtraFields({ unknownField: 'value' });

        expect(extraFields).toEqual(['unknownField']);
    });
});
