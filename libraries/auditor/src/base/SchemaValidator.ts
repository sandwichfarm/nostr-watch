
import Ajv, { ValidateFunction } from "ajv";
import ajvErrors from "ajv-errors";

export class SchemaValidator<T> {
  private ajv = new Ajv({
    strict: false, 
    allErrors: true
  });
  private validateFn: ValidateFunction;

  constructor(schema: any) {
    ajvErrors(this.ajv)
    this.validateFn = this.ajv.compile<T>(schema);
  }

  validate(data: T): boolean {
    return this.validateFn(data) as boolean;
  }
}