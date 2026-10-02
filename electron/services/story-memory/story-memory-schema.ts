export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
};

export const storyMemorySchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['synopsis', 'events', 'characters', 'plotHooks'],
  properties: {
    synopsis: { type: 'string', maxLength: 1500 },
    events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'importance'],
        properties: {
          description: { type: 'string', minLength: 1 },
          importance: { type: 'string', enum: ['상', '중', '하'] },
        },
      },
    },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          info: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          status: { type: 'string', enum: ['active', 'dead', 'left', 'unknown'] },
        },
      },
    },
    plotHooks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          status: { type: 'string', enum: ['unresolved', 'resolved'] },
        },
      },
    },
  },
};

// Validate against the same schema sent to both providers, without another runtime dependency.
export function validateSchema(value: unknown, schema: JsonSchema, path = 'response'): void {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error(`${path}: 객체 필요`);
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) throw new Error(`${path}.${key}: 필수 필드 누락`);
    }
    for (const [key, item] of Object.entries(record)) {
      const child = schema.properties?.[key];
      if (child) validateSchema(item, child, `${path}.${key}`);
      else if (schema.additionalProperties === false)
        throw new Error(`${path}.${key}: 허용되지 않은 필드`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${path}: 배열 필요`);
    value.forEach((item, index) => validateSchema(item, schema.items!, `${path}[${index}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${path}: 문자열 필요`);
    if (schema.minLength && value.trim().length < schema.minLength)
      throw new Error(`${path}: 빈 값 금지`);
    if (schema.maxLength && value.length > schema.maxLength)
      throw new Error(`${path}: ${schema.maxLength}자 초과`);
    if (schema.enum && !schema.enum.includes(value))
      throw new Error(`${path}: ${schema.enum.join('/')} 중 하나 필요`);
  }
}
