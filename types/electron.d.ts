export {};

declare global {
  interface WorkspaceBackupStatus {
    workspacePath: string;
    lastBackupAt: string | null;
    overdue: boolean;
  }

  type WorkspaceNodeType = 'document' | 'workspace';

  type NovelType = 'long' | 'short';

  type WorkspaceNodeWorkspace = {
    description?: string;
    coverPath?: string;
    novelType?: NovelType;
    deletedAt?: string | null;
  };

  type WorkspaceNodeDocument = {
    title?: string;
    subTitle?: string;
    draft?: ScriptContent;
    manuscript?: ScriptContent;
    storyMemory?: StoryMemory;
    draftLength?: number;
    draftCharsWithoutSpaces?: number;
    manuscriptLength?: number;
    manuscriptCharsWithoutSpaces?: number;
    deletedAt?: string | null;
  };

  type ScriptContent = {
    content: string;
    charsWithSpaces: number;
    charsWithoutSpaces: number;
    createdAt: string;
    updatedAt: string;
  };

  type StoryMemoryImportance = '상' | '중' | '하';

  type StoryMemoryEvent = {
    description: string;
    importance: StoryMemoryImportance;
  };

  type StoryMemoryCharacter = {
    id?: string;
    introducedAt?: string;
    introducedAtTitle?: string;
    recordedAt?: string;
    name: string;
    info: string;
    keywords: string[];
    summary: string;
  };

  type StoryMemoryPlotHook = {
    id?: string;
    plantedChapterId?: string;
    resolvedAt?: string;
    resolvedAtTitle?: string;
    description: string;
    plantedAt: string;
    status?: 'unresolved' | 'resolved';
  };

  type StoryMemory = {
    synopsis: string;
    events: StoryMemoryEvent[];
    characters: StoryMemoryCharacter[];
    plotHooks: StoryMemoryPlotHook[];
    generatedAt: string;
  };

  type StoryMemoryDraft = {
    synopsis: string;
    events: StoryMemoryEvent[];
    characters: StoryMemoryCharacter[];
    plotHooks: StoryMemoryPlotHook[];
  };

  type WorkspaceNode = {
    id?: string;
    type: WorkspaceNodeType;
    path: string;
    parentPath: string;
    parentId?: string | null;
    name: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string | null;
    trashed?: boolean;
    workspace?: WorkspaceNodeWorkspace;
    document?: WorkspaceNodeDocument;
    children?: WorkspaceNode[];
    recentVisits?: WorkspaceNode[];
  };

  type WorkspaceInfo = {
    path: string;
    exists: boolean;
  };

  type Setting = {
    selectedEmbeddingModel: string | null;
    selectedLLMModel: string | null;
  };

  type WorkspaceUpdatePayload = {
    name?: string;
    deletedAt?: string | null;
    workspace?: Pick<WorkspaceNodeWorkspace, 'description' | 'coverPath'>;
  };

  type DocumentUpdatePayload = {
    name?: string;
    deletedAt?: string | null;
    document?: Pick<WorkspaceNodeDocument, 'title' | 'subTitle' | 'draft' | 'manuscript'>;
  };

  type GenerateCommentsPayload = {
    documentPath: string;
    startAge: number;
    endAge: number;
    expertise?: number;
    readingExperiences?: Array<'입문' | '일반' | '숙련' | '창작 경험'>;
    interests?: Array<'캐릭터' | '인물 관계' | '전개' | '세계관' | '문장'>;
    reactions?: Array<'몰입' | '기대' | '의문' | '추측' | '분석' | '아쉬움' | '지적'>;
    count: number;
  };

  type CommentExample = {
    id: string;
    content: string;
    tone: string | null;
    interest: string | null;
    ageGroup: number | null;
    expertiseLevel: number | null;
    genre: string | null;
    source: string | null;
    createdAt: string;
    updatedAt: string;
  };

  type AddCommentExamplePayload = {
    content: string;
    tone?: string | null;
    interest?: string | null;
    ageGroup?: number | null;
    expertiseLevel?: number | null;
    genre?: string | null;
    source?: string | null;
  };

  type GeneratedComment = {
    id: string;
    ageGroup: number;
    expertiseLevel: number;
    expertiseLabel: string;
    content: string;
    tone: string;
    usedContext: boolean;
    createdAt: string;
  };

  type OllamaModel = {
    name: string;
    model: string;
    modified_at: Date;
    size: number;
    digest: string;
    details: {
      format: string;
      family: string;
      families: string[] | null;
      parameter_size: string;
      quantization_level: string;
      parent_model: string;
    };
    capabilities: string[];
  };

  interface Window {
    electronMeta?: {
      preloadReady: boolean;
    };
    electronAPI: {
      getWorkspaceBackupStatus: () => Promise<WorkspaceBackupStatus>;
      backupWorkspace: () => Promise<{ path: string } | null>;
      restoreWorkspaceBackup: () => Promise<WorkspaceInfo | null>;
      recoverDocument: (documentPath: string) => Promise<WorkspaceNode>;
      selectFolder: () => Promise<WorkspaceNode | null>;
      readFile: (filePath: string) => Promise<string>;
      readImage: (filePath: string) => Promise<string>;

      getWorkspaceTree: (path?: string) => Promise<WorkspaceNode[]>;
      getTrashItems: () => Promise<WorkspaceNode[]>;
      onWorkspaceTreeChanged: (listener: () => void) => () => void;
      getCurrentWorkspacePath: () => Promise<WorkspaceInfo>;
      initCurrentWorkspace: () => Promise<WorkspaceInfo>;
      selectWorkspacePath: () => Promise<WorkspaceInfo | null>;
      resetWorkspacePath: () => Promise<WorkspaceInfo>;
      updateWorkspaceRoot: (targetPath: string) => Promise<WorkspaceInfo>;
      createWorkspace: (
        name: string,
        novelType?: NovelType,
      ) => Promise<{ name: string; path: string }>;
      renameWorkspace: (
        oldWorkspacePath: string,
        newName: string,
      ) => Promise<{ oldPath: string; newPath: string }>;
      removeWorkspace: (targetPath: string) => Promise<{ removed: boolean; path: string }>;
      purgeWorkspace: (targetPath: string) => Promise<{ removed: boolean; path: string }>;
      restoreWorkspace: (targetPath: string) => Promise<{ restored: boolean; path: string }>;
      getWorkspaceInfo: (targetPath: string) => Promise<WorkspaceNode>;
      updateWorkspaceInfo: (
        targetPath: string,
        workspaceInfo: WorkspaceUpdatePayload,
      ) => Promise<WorkspaceNode>;

      createDocument: (targetPath: string, name?: string) => Promise<WorkspaceNode>;
      getDocument: (documentPath: string) => Promise<WorkspaceNode>;
      removeDocument: (documentPath: string) => Promise<{ removed: boolean; path: string }>;
      purgeDocument: (documentPath: string) => Promise<{ removed: boolean; path: string }>;
      restoreDocument: (documentPath: string) => Promise<{ restored: boolean; path: string }>;
      updateDocument: (documentPath: string, data: DocumentUpdatePayload) => Promise<WorkspaceNode>;

      getSettingInfo: () => Promise<Setting>;
      updateSelectedEmbeddingModel: (selectedEmbeddingModel: string | null) => Promise<Setting>;
      updateSelectedLLMModel: (selectedLLMModel: string | null) => Promise<Setting>;

      saveImage: (workflowPath: string, fileName: string, buffer: number[]) => Promise<string>;
      removeFile: (filePath: string) => Promise<void>;
      showInFolder: (filePath: string) => Promise<void>;

      generateStoryMemory: (documentPath: string) => Promise<StoryMemoryDraft>;
      saveStoryMemory: (documentPath: string, draft: StoryMemoryDraft) => Promise<StoryMemory>;
      getLatestStoryMemory: (groupPath: string) => Promise<StoryMemory | null>;

      isOllamaRunning: () => Promise<boolean>;
      listOllamaModels: () => Promise<{ models: OllamaModel[] }>;

      addCommentExample: (payload: AddCommentExamplePayload) => Promise<CommentExample>;
      generateComments: (payload: GenerateCommentsPayload) => Promise<GeneratedComment[]>;
      listCommentExamples: () => Promise<CommentExample[]>;
      removeCommentExample: (id: string) => Promise<{ removed: boolean; id: string }>;
      listGeneratedComments: (documentPath: string) => Promise<GeneratedComment[]>;
      removeGeneratedComment: (
        documentPath: string,
        commentId: string | string[],
      ) => Promise<{ removed: boolean; id: string | string[] }>;
    };
  }
}
