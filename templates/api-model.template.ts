/*
type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new TypeError('__NAME__Model requires an object payload.');
}

export class __NAME__Model {

  readonly id: string;

  constructor(options: { id: string }) {
    this.id = options.id;
  }

  static fromJson(value: unknown): __NAME__Model {
    const json = asRecord(value);
    if (typeof json.id !== 'string') throw new TypeError('__NAME__Model requires a string id.');
    return new __NAME__Model({ id: json.id });
  }

}
*/
