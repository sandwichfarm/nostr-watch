export class Auditor {
  data: Map<string, { pass: boolean } | Record<string, any>> = new Map();

  constructor() {}

  pass(code: string): void {
    this.data.set(code, { pass: true });
  }

  fail(code: string, result: Record<string, any>): void {
    this.data.set(code, { ...result, pass: false });
  }

  get(code: string): { pass: boolean } | Record<string, any> | undefined {
    return this.data.get(code);
  }

  dump(): Record<string, any> {
    return Object.fromEntries(this.data.entries());
  }

  tag(): any[] {
    return Array.from(this.data.entries()).map(([code, values]) => ['audit', code, ...Object.values(values)]);
  }
}
