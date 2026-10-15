import { AppError } from '../../common/app-error.js';
import type { StoredScriptContent } from './store-types.js';

export type WorkspaceUpdatePayload = {
  name?: string;
  deletedAt?: string | null;
  workspace?: {
    description?: string;
    coverPath?: string;
  };
};

export type DocumentUpdatePayload = {
  name?: string;
  deletedAt?: string | null;
  document?: {
    title?: string;
    subTitle?: string;
    draft?: StoredScriptContent;
    manuscript?: StoredScriptContent;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError('INVALID_INPUT', { diagnostic: `${fieldName} must be a string.` });
  }

  return value;
}

function optionalNullableString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'string') {
    return value;
  }

  throw new AppError('INVALID_INPUT', { diagnostic: `${fieldName} must be a string or null.` });
}

function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new AppError('INVALID_INPUT', { diagnostic: `${fieldName} must be a string.` });
  }

  return value;
}

function requiredNumber(value: unknown, fieldName: string) {
  if (typeof value !== 'number') {
    throw new AppError('INVALID_INPUT', { diagnostic: `${fieldName} must be a number.` });
  }

  return value;
}

function optionalScriptContent(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new AppError('INVALID_INPUT', { diagnostic: `${fieldName} must be an object.` });
  }

  return {
    content: requiredString(value.content, `${fieldName}.content`),
    charsWithSpaces: requiredNumber(value.charsWithSpaces, `${fieldName}.charsWithSpaces`),
    charsWithoutSpaces: requiredNumber(value.charsWithoutSpaces, `${fieldName}.charsWithoutSpaces`),
    createdAt: requiredString(value.createdAt, `${fieldName}.createdAt`),
    updatedAt: requiredString(value.updatedAt, `${fieldName}.updatedAt`),
  };
}

export function parseWorkspaceUpdatePayload(value: unknown): WorkspaceUpdatePayload {
  if (!isRecord(value)) {
    throw new AppError('WORKSPACE_PAYLOAD_INVALID');
  }

  const workspace = value.workspace;
  if (workspace !== undefined && !isRecord(workspace)) {
    throw new AppError('WORKSPACE_INFO_INVALID');
  }

  return {
    name: optionalString(value.name, 'workspaceInfo.name'),
    deletedAt: optionalNullableString(value.deletedAt, 'workspaceInfo.deletedAt'),
    workspace:
      workspace === undefined
        ? undefined
        : {
            description: optionalString(
              workspace.description,
              'workspaceInfo.workspace.description',
            ),
            coverPath: optionalString(workspace.coverPath, 'workspaceInfo.workspace.coverPath'),
          },
  };
}

export function parseDocumentUpdatePayload(value: unknown): DocumentUpdatePayload {
  if (!isRecord(value)) {
    throw new AppError('DOCUMENT_PAYLOAD_INVALID');
  }

  const document = value.document;
  if (document !== undefined && !isRecord(document)) {
    throw new AppError('DOCUMENT_INFO_INVALID');
  }

  return {
    name: optionalString(value.name, 'document data.name'),
    deletedAt: optionalNullableString(value.deletedAt, 'document data.deletedAt'),
    document:
      document === undefined
        ? undefined
        : {
            title: optionalString(document.title, 'document data.document.title'),
            subTitle: optionalString(document.subTitle, 'document data.document.subTitle'),
            draft: optionalScriptContent(document.draft, 'document data.document.draft'),
            manuscript: optionalScriptContent(
              document.manuscript,
              'document data.document.manuscript',
            ),
          },
  };
}
