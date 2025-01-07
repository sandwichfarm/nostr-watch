const fs = require("fs")
const nip01 = require( "@nostrwatch/nip01-schema")

fs.writeFileSync( "./src/nip01.json", JSON.stringify(nip01) )