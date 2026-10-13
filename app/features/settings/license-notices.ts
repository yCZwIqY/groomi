export type LicenseNotice = {
  name: string;
  version: string;
  license: string;
  source: string;
  file: string;
  requiresReview: boolean;
};

export async function loadLicenseIndex(signal: AbortSignal): Promise<LicenseNotice[]> {
  const response = await fetch('/licenses/index.json', { signal });
  if (!response.ok) throw new Error('라이선스 목록을 불러오지 못했습니다.');
  const data = (await response.json()) as { entries: LicenseNotice[] };
  return data.entries;
}
