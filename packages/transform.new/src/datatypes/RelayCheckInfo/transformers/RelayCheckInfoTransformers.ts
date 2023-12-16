import objectMapper from 'object-mapper';
import { NocapRelayCheckInfo } from '../NocapRelayCheckInfo';
import { RdbRelayCheckInfo } from './RdbRelayCheckInfo';

export class RelayCheckInfoTransformers {
    static nocapToRdb(nocap: NocapRelayCheckInfo): object {
        const nocapToRdbMapping = {
            // Top-level fields mapping
            "url": "dropped_fields[]",
            "network": "dropped_fields[]",
            "adapters": "adapters",
            "checked_at": "checked_at",
            "checked_by": "checked_by",
            "info.status": "dropped_fields[]",
            "info.duration": "dropped_fields[]",

            // Mapping nested 'info.data' fields
            "info.data.name": "data.name",
            "info.data.description": "data.description",
            "info.data.pubkey": "data.pubkey",
            "info.data.contact": "data.contact",
            "info.data.software": "data.software",
            "info.data.version": "data.version",
            "info.data.payments_url": "data.payments_url",
            "info.data.supported_nips": "data.supported_nips",
            "info.data.supported_nip_extensions": "data.supported_nip_extensions",

            // Mapping 'info.data.limitation' object
            "info.data.limitation.max_message_length": "data.limitation.max_message_length",
            "info.data.limitation.max_subscriptions": "data.limitation.max_subscriptions",
            "info.data.limitation.max_filters": "data.limitation.max_filters",
            "info.data.limitation.max_limit": "data.limitation.max_limit",
            "info.data.limitation.max_subid_length": "data.limitation.max_subid_length",
            "info.data.limitation.min_prefix": "data.limitation.min_prefix",
            "info.data.limitation.max_event_tags": "data.limitation.max_event_tags",
            "info.data.limitation.max_content_length": "data.limitation.max_content_length",
            "info.data.limitation.min_pow_difficulty": "data.limitation.min_pow_difficulty",
            "info.data.limitation.auth_required": "data.limitation.auth_required",
            "info.data.limitation.payment_required": "data.limitation.payment_required",

            // Mapping 'info.data.fees' object
            "info.data.fees.admission": "data.fees.admission"
        };

        return objectMapper(nocap, nocapToRdbMapping);
    }

    static rdbToNocap(rdb: RdbRelayCheckInfo): object {
        const rdbToNocapMapping = {
            "relay_id": "dropped_fields[]",
            "checked_at": "checked_at",
            "checked_by": "checked_by",
            "adapters": "adapters",
            "data.name": "info.data.name",
            "data.description": "info.data.description",
            "data.pubkey": "info.data.pubkey",
            "data.contact": "info.data.contact",
            "data.software": "info.data.software",
            "data.version": "info.data.version",
            "data.payments_url": "info.data.payments_url",
            "data.supported_nips": "info.data.supported_nips",
            "data.supported_nip_extensions": "info.data.supported_nip_extensions",
            
            // Mapping 'data.limitation' object
            "data.limitation.max_message_length": "info.data.limitation.max_message_length",
            "data.limitation.max_subscriptions": "info.data.limitation.max_subscriptions",
            "data.limitation.max_filters": "info.data.limitation.max_filters",
            "data.limitation.max_limit": "info.data.limitation.max_limit",
            "data.limitation.max_subid_length": "info.data.limitation.max_subid_length",
            "data.limitation.min_prefix": "info.data.limitation.min_prefix",
            "data.limitation.max_event_tags": "info.data.limitation.max_event_tags",
            "data.limitation.max_content_length": "info.data.limitation.max_content_length",
            "data.limitation.min_pow_difficulty": "info.data.limitation.min_pow_difficulty",
            "data.limitation.auth_required": "info.data.limitation.auth_required",
            "data.limitation.payment_required": "info.data.limitation.payment_required",

            // Mapping 'data.fees' object
            "data.fees.admission": "info.data.fees.admission"
        };

        return objectMapper(rdb, rdbToNocapMapping);
    }
    
}
