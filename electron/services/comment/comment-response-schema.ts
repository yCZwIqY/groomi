export function buildCommentResponseSchema(count: number) {
  return {
    type: 'object',
    required: ['comments'],
    additionalProperties: false,
    properties: {
      comments: {
        type: 'array',
        minItems: count,
        maxItems: count,
        items: {
          type: 'object',
          required: ['content', 'tone', 'usedContext'],
          properties: {
            content: { type: 'string', minLength: 1 },
            tone: { type: 'string' },
            usedContext: { type: 'boolean' },
            ageGroup: { type: 'number' },
            expertiseLevel: { type: 'number' },
            expertiseLabel: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
  };
}
