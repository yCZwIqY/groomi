export type StoredNodeType = 'workspace' | 'document';

export type StoredScriptContent = {
  content: string;
  charsWithSpaces: number;
  charsWithoutSpaces: number;
  createdAt: string;
  updatedAt: string;
};

export type StoryMemoryImportance = '상' | '중' | '하';

export type StoryMemoryEvent = {
  description: string;
  importance: StoryMemoryImportance;
};

export type StoryMemoryCharacter = {
  status?: 'active' | 'dead' | 'left' | 'unknown';
  id?: string;
  introducedAt?: string;
  introducedAtTitle?: string;
  recordedAt?: string;
  name: string;
  info: string;
  keywords: string[];
  summary: string;
};

export type StoryMemoryPlotHook = {
  id?: string;
  plantedChapterId?: string;
  resolvedAt?: string;
  resolvedAtTitle?: string;
  description: string;
  plantedAt: string;
  status?: 'unresolved' | 'resolved';
};

export type StoryMemory = {
  eventsMode?: 'chapter';
  contextFingerprint?: string;
  sourceManuscriptHash?: string;
  stale?: boolean;
  synopsis: string;
  events: StoryMemoryEvent[];
  characters: StoryMemoryCharacter[];
  plotHooks: StoryMemoryPlotHook[];
  generatedAt: string;
};

export type NovelType = 'long' | 'short';

export type StoredDocumentContent = {
  id?: string;
  title?: string;
  subTitle?: string;
  draft?: StoredScriptContent;
  manuscript?: StoredScriptContent;
  storyMemory?: StoryMemory;
};

export type WorkspaceStoreRoot = {
  id: string;
  name: string;
  description: string;
  coverPath: string;
  novelType: NovelType;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type WorkspaceStoreGroup = WorkspaceStoreRoot & {
  type: 'workspace';
  parentId: string | null;
};

export type WorkspaceStoreDocument = {
  id: string;
  type: 'document';
  parentId: string | null;
  name: string;
  title: string;
  subTitle?: string;
  draftPath?: string;
  manuscriptPath?: string;
  draftLength: number;
  draftCharsWithoutSpaces: number;
  manuscriptLength: number;
  manuscriptCharsWithoutSpaces: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type WorkspaceStoreRecentVisit = {
  id?: string;
  path?: string;
  [key: string]: unknown;
};

export type WorkspaceStoreSettingInfo = {
  aiProvider?: 'ollama' | 'openrouter';
  openRouterModel?: string | null;
  selectedEmbeddingModel: string | null;
  selectedLLMModel: string | null;
};

export type WorkspaceStore = {
  version: number;
  workspace: WorkspaceStoreRoot;
  groups: WorkspaceStoreGroup[];
  documents: WorkspaceStoreDocument[];
  recentVisits: WorkspaceStoreRecentVisit[];
  settingInfo: WorkspaceStoreSettingInfo;
};

export type StoredDocumentMetaInput = Partial<WorkspaceStoreDocument> &
  Pick<WorkspaceStoreDocument, 'id' | 'name'> & {
    draft?: StoredScriptContent;
    manuscript?: StoredScriptContent;
  };

export type ManuscriptReviewCriterionKey =
  | 'contextConsistency'
  | 'pacing'
  | 'readability'
  | 'characterConsistency'
  | 'hook';
export type ManuscriptReviewCriterion = { score: number; comment: string };
export type ManuscriptReview = {
  criteria: Record<ManuscriptReviewCriterionKey, ManuscriptReviewCriterion>;
  overallComment: string;
};
