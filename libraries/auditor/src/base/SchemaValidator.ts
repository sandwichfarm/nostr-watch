
import Ajv, { ValidateFunction } from "ajv";
import ajvErrors from "ajv-errors";

const cloneSchema = <T>(schema: T): T => {
  if (typeof structuredClone === "function") return structuredClone(schema);
  return JSON.parse(JSON.stringify(schema)) as T;
};

const stripNestedSchemaIds = (schema: unknown): void => {
  if (!schema || typeof schema !== "object") return;

  const seen = new WeakSet<object>();

  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object") return;
    if (seen.has(value as object)) return;
    seen.add(value as object);

    if (!Array.isArray(value) && depth > 0 && typeof (value as any).$id === "string") {
      delete (value as any).$id;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }

    Object.values(value as Record<string, unknown>).forEach((child) => visit(child, depth + 1));
  };

  visit(schema, 0);
};

export class SchemaValidator<T> {
  private ajv = new Ajv({
    strict: false,
    allErrors: true
  });
  private validateFn: ValidateFunction | null = null;
  private compileError: string | null = null;

  constructor(schema: any) {
    ajvErrors(this.ajv)
    const cleaned = cloneSchema(schema);
    stripNestedSchemaIds(cleaned);
    try {
      this.validateFn = this.ajv.compile<T>(cleaned);
    } catch (e: any) {
      this.compileError = e?.message ?? String(e);
      console.warn(`SchemaValidator: failed to compile schema: ${this.compileError}`);
    }
  }

  validate(data: T): boolean {
    if (!this.validateFn) return false;
    return this.validateFn(data) as boolean;
  }
}
