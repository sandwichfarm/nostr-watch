# @nostrwatch/schemata-js-ajv

A simple library written in Typescript for validating nostr JSON payloads. Presently support validation of notes, several kinds, NIP-11 information documents and some protocol messages. Implements [`@nostrwatch/schemata`](../schemata/)

# important notes

- Very early development
- a lot of false negatives and positives. 
- Less than 5 note kinds have been implemented. 
- API requires some work. 

# install
```
pnpm install @nostrwatch/schemata-js-ajv
```

# usage 
```
import { validateNip11, validateMessage, validateNote } from '@nostrwatch/schemata-js-ajv'

const nip11Valid = await validateNip11({ title: "my relay", software: "...", ....})
const relayMessageValid = validateMessage(['NOTICE', this is a notice], 'relay')
const kind1Valid = validateNote({ ... })
```

example success result
```json
{
    "status": "success",
    "hash": "93dcf578",
    "result": {
        "valid": true,
        "errors": [],
        "warnings": []
    }
}
```

example fail result
```json
{
    "status": "success",
    "hash": "3a15ab64",
    "result": {
        "valid": false,
        "errors": [
            {
                "instancePath": "/contact",
                "schemaPath": "#/properties/contact/type",
                "keyword": "type",
                "params": {
                    "type": "string"
                },
                "message": "must be string"
            }
        ],
        "warnings": []
    }
}
```

