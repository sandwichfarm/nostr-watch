import fs from "fs"
import schema from "@nostrwatch/nip66-schema"  

fs.writeFileSync( "./dist/schema.json", JSON.stringify(schema) )