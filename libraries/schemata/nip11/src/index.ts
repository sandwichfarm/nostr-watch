export * as Nip11Types from './types';
export * as Nip11Serialize from './serialize';

import Ajv, { ValidateFunction } from 'ajv';
import * as YAML from 'yaml';


let fs: typeof import('fs').promises | undefined;
if (typeof window === 'undefined') {
  fs = require('fs').promises;
}

declare const define: {
  (deps: string[], factory: (...modules: any[]) => any): void;
  amd?: boolean;
};

type Schema = object;

declare global {
  interface Window {
    Ajv: typeof Ajv;
    YAML: typeof YAML;
    nip11: typeof nip11;
  }
}

async function loadSchema(schemaPath: string): Promise<Schema> {
  if (typeof fetch !== 'undefined') {
    const response = await fetch(schemaPath);
    return YAML.parse(await response.text());
  } else if (fs) {
    const schemaContent = await fs.readFile(schemaPath, 'utf8');
    return YAML.parse(schemaContent);
  } else {
    throw new Error('Cannot load schema in this environment');
  }
}

class nip11 {
  private ajv: Ajv;
  private schemaPath: string;
  private schema: Schema | null;
  private validator: ValidateFunction<any> | null;

  constructor(schemaPath: string) {
    this.ajv = new Ajv();
    this.schemaPath = schemaPath;
    this.schema = null;
    this.validator = null;
  }

  async loadSchema(): Promise<void> {
    this.schema = await loadSchema(this.schemaPath);
    if (this.schema) {
      this.validator = this.ajv.compile(this.schema);
    } else {
      throw new Error('Schema could not be loaded or is invalid');
    }
  }

  async validate(data: any): Promise<{ valid: boolean; errors: ValidateFunction<any>['errors'] }> {
    if (!this.schema) {
      await this.loadSchema();
    }
    if (!this.validator) {
      throw new Error('Validator not initialized. Ensure schema is loaded correctly.');
    }
    const valid = this.validator(data);
    return { valid, errors: this.validator.errors };
  }


}


(function (root: any, factory: (Ajv: any, YAML: any, fs?: any) => any) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['ajv', 'yaml'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js
    module.exports = factory(require('ajv'), require('yaml'), require('fs').promises);
  } else {
    // Browser globals
    if (root !== undefined) {
      root.nip11 = factory(root.Ajv, root.YAML);
    } else {
      throw new Error('Global object "root" is undefined.');
    }
  }
}(typeof self !== 'undefined' ? self : this, function (Ajv: any, YAML: any, fs?: any) {
  return nip11;
}));
