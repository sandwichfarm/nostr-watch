import Ajv, { ValidateFunction } from "ajv";

export class SchemaValidator<T> {
  private ajv = new Ajv();
  private validateFn: ValidateFunction;

  constructor(schema: any) {
    this.validateFn = this.ajv.compile<T>(schema);
  }

  validate(data: T): boolean {
    return this.validateFn(data) as boolean;
  }
}