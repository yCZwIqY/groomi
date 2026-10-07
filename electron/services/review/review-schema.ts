import type { JsonSchema } from '../json-schema.js';
const criterion: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'comment'],
  properties: {
    score: { type: 'number', minimum: 1, maximum: 10 },
    comment: { type: 'string', minLength: 1 },
  },
};
export const manuscriptReviewSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['criteria', 'overallComment'],
  properties: {
    criteria: {
      type: 'object',
      additionalProperties: false,
      required: ['contextConsistency', 'pacing', 'readability', 'characterConsistency', 'hook'],
      properties: {
        contextConsistency: criterion,
        pacing: criterion,
        readability: criterion,
        characterConsistency: criterion,
        hook: criterion,
      },
    },
    overallComment: { type: 'string', minLength: 1 },
  },
};
