import { requireElectronApi } from './client';
export async function generateManuscriptReview(documentPath: string) {
  return requireElectronApi().generateManuscriptReview(documentPath);
}
