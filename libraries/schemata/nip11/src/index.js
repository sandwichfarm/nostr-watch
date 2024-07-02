// import Ajv from 'ajv'
import schema from './schema.yaml';
// import YAML from 'yaml'

console.log('Schema loaded:', schema);

// export class nip11 {
//   ajv 
//   data = {} 
//   schema = {}

//   constructor(){
//     this.ajv = new Ajv()
//     // this.schema = YAML.parse(schema)
    
//   }

//   validate(data){
//     const validate = this.ajv.compile(this.schema)
//     const valid = validate(data)
//     return { valid, errors: validate.errors }
//   }
// }