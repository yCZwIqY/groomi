import { requireElectronApi } from '~/lib/electron/client';

export async function addCommentExample(payload: AddCommentExamplePayload) {
  return requireElectronApi().addCommentExample(payload);
}

export async function generateComments(payload: GenerateCommentsPayload) {
  try {
    return await requireElectronApi().generateComments(payload);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message.replace(/^Error invoking remote method '[^']+':\s*/, ''));
    }
    throw error;
  }
}

export async function listCommentExamples() {
  return requireElectronApi().listCommentExamples();
}

export async function removeCommentExample(id: string | string[]) {
  return requireElectronApi().removeCommentExample(id);
}

export async function listGeneratedComments(documentPath: string) {
  return requireElectronApi().listGeneratedComments(documentPath);
}

export async function removeGeneratedComment(documentPath: string, commentId: string | string[]) {
  return requireElectronApi().removeGeneratedComment(documentPath, commentId);
}
