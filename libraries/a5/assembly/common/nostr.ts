// NIP-A5 Host API bindings for AssemblyScript
// These are the functions provided by the host runtime

// --- Request building ---

@external("nostr", "req_new")
export declare function req_new(): i32;

@external("nostr", "req_add_author")
export declare function req_add_author(req: i32, pubkey_ptr: i32): void;

@external("nostr", "req_add_author_hex")
export declare function req_add_author_hex(req: i32, pubkey_hex_ptr: i32): void;

@external("nostr", "req_add_id")
export declare function req_add_id(req: i32, id_ptr: i32): void;

@external("nostr", "req_add_id_hex")
export declare function req_add_id_hex(req: i32, id_hex_ptr: i32): void;

@external("nostr", "req_add_kind")
export declare function req_add_kind(req: i32, kind: i32): void;

@external("nostr", "req_add_tag")
export declare function req_add_tag(req: i32, tag_ptr: i32, tag_len: i32, value_ptr: i32, value_len: i32): void;

@external("nostr", "req_add_tag_bin32")
export declare function req_add_tag_bin32(req: i32, tag_ptr: i32, tag_len: i32, value_ptr: i32): void;

@external("nostr", "req_set_limit")
export declare function req_set_limit(req: i32, limit: i32): void;

@external("nostr", "req_set_since")
export declare function req_set_since(req: i32, timestamp: i32): void;

@external("nostr", "req_set_until")
export declare function req_set_until(req: i32, timestamp: i32): void;

@external("nostr", "req_set_search")
export declare function req_set_search(req: i32, ptr: i32, len: i32): void;

@external("nostr", "req_add_relay")
export declare function req_add_relay(req: i32, ptr: i32, len: i32): void;

@external("nostr", "req_close_on_eose")
export declare function req_close_on_eose(req: i32): void;

// --- Subscription ---

@external("nostr", "subscribe")
export declare function subscribe(req: i32): i32;

// --- Event accessors ---

@external("nostr", "event_get_id")
export declare function event_get_id(event_handle: i32): i32;

@external("nostr", "event_get_id_hex")
export declare function event_get_id_hex(event_handle: i32): i32;

@external("nostr", "event_get_pubkey")
export declare function event_get_pubkey(event_handle: i32): i32;

@external("nostr", "event_get_pubkey_hex")
export declare function event_get_pubkey_hex(event_handle: i32): i32;

@external("nostr", "event_get_kind")
export declare function event_get_kind(event_handle: i32): i32;

@external("nostr", "event_get_created_at")
export declare function event_get_created_at(event_handle: i32): i32;

@external("nostr", "event_get_content")
export declare function event_get_content(event_handle: i32): i32;

@external("nostr", "event_get_tag_count")
export declare function event_get_tag_count(event_handle: i32): i32;

@external("nostr", "event_get_tag_item_count")
export declare function event_get_tag_item_count(event_handle: i32, tag_index: i32): i32;

@external("nostr", "event_get_tag_item")
export declare function event_get_tag_item(event_handle: i32, tag_index: i32, item_index: i32): i32;

@external("nostr", "event_get_tag_item_bin32")
export declare function event_get_tag_item_bin32(event_handle: i32, tag_index: i32, item_index: i32): i32;

@external("nostr", "event_get_tag_item_by_name")
export declare function event_get_tag_item_by_name(event_handle: i32, name_ptr: i32, name_len: i32, item_index: i32): i32;

@external("nostr", "event_get_tag_item_by_name_bin32")
export declare function event_get_tag_item_by_name_bin32(event_handle: i32, name_ptr: i32, name_len: i32, item_index: i32): i32;

// --- Display & utility ---

@external("nostr", "display")
export declare function display(event: i32): void;

@external("nostr", "log")
export declare function nostr_log_raw(ptr: i32, len: i32): void;

@external("nostr", "drop")
export declare function drop(handle: i32): void;
