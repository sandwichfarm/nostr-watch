export default {
  "$id": "https://nip11.schemata.nostr.watch",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NIP-11",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "pubkey": {
      "type": "string"
    },
    "contact": {
      "type": "string"
    },
    "supported_nips": {
      "type": "array",
      "items": {
        "type": "number"
      }
    },
    "software": {
      "type": "string"
    },
    "version": {
      "type": "string"
    },
    "retention": {
      "type": "array",
      "items": "#/$defs/retent"
    },
    "relay_country": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "icon": {
      "anyOf": [
        { "$ref": "#/$def/saneUrl" },
        { "format": "hostname" }
      ]
    },
    "language_tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    
    "posting_policy": {
      "anyOf": [
        { "$ref": "#/$def/saneUrl" },
        { "format": "hostname" }
      ]
    },
    "limitation": {
      "type": "object",
      "properties": {
        "max_message_length": {
          "type": "number"
        },
        "max_subscriptions": {
          "type": "number"
        },
        "max_filters": {
          "type": "number"
        },
        "max_limit": {
          "type": "number"
        },
        "max_subid_length": {
          "type": "number"
        },
        "max_event_tags": {
          "type": "number"
        },
        "max_content_length": {
          "type": "number"
        },
        "min_pow_difficulty": {
          "type": "number"
        },
        "auth_required": {
          "type": "boolean"
        },
        "payment_required": {
          "type": "boolean"
        },
        "restricted_writes": {
          "type": "boolean"
        },
        "created_at_lower_limit": {
          "type": "number"
        },
        "created_at_upper_limit": {
          "type": "number"
        },
      }      
    },
    "payments_url": {
      "anyOf": [
        { "$ref": "#/$def/saneUrl" },
        { "format": "hostname" }
      ]
    },
    "fees": {
      "admission": "#/$def/fee",
      "subscription": "#/$def/fee",
      "publication": "#/$def/fee",
    },
  },
  "required": [
    "name",
    "description",
    "pubkey",
    "contact",
    "supported_nips",
    "software",
    "version"
  ],

  "$defs": {
    "saneUrl": { 
      "format": "uri", 
      "pattern": "^https?://" 
    },
    "fee": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "amount": {
            "type": "number"
          },
          "unit": {
            "type": "string"
          },
          "period": {
            "type": "number"
          },
          "kinds": {
            "type": "array",
            "items": {
              "type": "number"
            }
          }
        }
      }
    },
    "retent": {
      "type": "object",
      "properties": {
          "kinds": {
            "type": "array",
            "items": {
              "anyOf": [
                {
                  "type": "number"
                },
                {
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                }
              ]
            }
          },
          "count": {
            "type": "number"
          },
          "time": {
            "type": "number"
          }
        },
      },
    }
  }