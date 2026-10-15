import { AppError } from '../common/app-error.js';
export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
};

// Validate against the same schema sent to both providers, without another runtime dependency.
export function validateSchema(value: unknown, schema: JsonSchema, path = 'response'): void {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new AppError('AI_RESPONSE_INVALID', { diagnostic: `${path}: 객체 필요` });
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record))
        throw new AppError('AI_RESPONSE_INVALID', { diagnostic: `${path}.${key}: 필수 필드 누락` });
    }
    for (const [key, item] of Object.entries(record)) {
      const child = schema.properties?.[key];
      if (child) validateSchema(item, child, `${path}.${key}`);
      else if (schema.additionalProperties === false)
        throw new AppError('AI_RESPONSE_INVALID', {
          diagnostic: `${path}.${key}: 허용되지 않은 필드`,
        });
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value))
      throw new AppError('AI_RESPONSE_INVALID', { diagnostic: `${path}: 배열 필요` });
    value.forEach((item, index) => validateSchema(item, schema.items!, `${path}[${index}]`));
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new AppError('AI_RESPONSE_INVALID', { diagnostic: `${path}: 숫자 필요` });
    if (schema.minimum !== undefined && value < schema.minimum)
      throw new AppError('AI_RESPONSE_INVALID', {
        diagnostic: `${path}: 최솟값 ${schema.minimum}`,
      });
    if (schema.maximum !== undefined && value > schema.maximum)
      throw new AppError('AI_RESPONSE_INVALID', {
        diagnostic: `${path}: 최댓값 ${schema.maximum}`,
      });
  } else if (schema.type === 'string') {
    if (typeof value !== 'string')
      throw new AppError('AI_RESPONSE_INVALID', { diagnostic: `${path}: 문자열 필요` });
    if (schema.minLength && value.trim().length < schema.minLength)
      throw new AppError('AI_RESPONSE_INVALID', { diagnostic: `${path}: 빈 값 금지` });
    if (schema.maxLength && value.length > schema.maxLength)
      throw new AppError('AI_RESPONSE_INVALID', {
        diagnostic: `${path}: ${schema.maxLength}자 초과`,
      });
    if (schema.enum && !schema.enum.includes(value))
      throw new AppError('AI_RESPONSE_INVALID', {
        diagnostic: `${path}: ${schema.enum.join('/')} 중 하나 필요`,
      });
  }
}
