import type { JsonSchema } from '../json-schema.js';

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
