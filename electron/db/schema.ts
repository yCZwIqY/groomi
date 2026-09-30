export const WORKSPACE_SCHEMA_VERSION = 2;

export const WORKSPACE_SCHEMA_STATEMENTS = [
  'PRAGMA foreign_keys = ON',
  `CREATE TABLE IF NOT EXISTS document_file_commits (documentId TEXT PRIMARY KEY, token TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS pending_document_deletions (documentId TEXT PRIMARY KEY)`,
  `
    CREATE TABLE IF NOT EXISTS setting_info (
      id TEXT PRIMARY KEY CHECK (id = 'default'),
      selectedEmbeddingModel TEXT,
      selectedLLMModel TEXT
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS workspace_nodes (
      id TEXT PRIMARY KEY,
      parentId TEXT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('workspace', 'document')),
      deleted INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      FOREIGN KEY (parentId) REFERENCES workspace_nodes(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS group_info (
      nodeId TEXT PRIMARY KEY,
      description TEXT,
      coverPath TEXT,
      novelType TEXT,
      FOREIGN KEY (nodeId) REFERENCES workspace_nodes(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS document_info (
      nodeId TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subTitle TEXT,
      draftPath TEXT,
      manuscriptPath TEXT,
      draftCharsWithSpaces INTEGER NOT NULL DEFAULT 0,
      draftCharsWithoutSpaces INTEGER NOT NULL DEFAULT 0,
      manuscriptCharsWithSpaces INTEGER NOT NULL DEFAULT 0,
      manuscriptCharsWithoutSpaces INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (nodeId) REFERENCES workspace_nodes(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS recent_visits (
      id TEXT PRIMARY KEY,
      sortOrder INTEGER NOT NULL,
      payload TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS comment_examples (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tone TEXT,
      ageGroup INTEGER,
      gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female')),
      expertiseLevel INTEGER,
      genre TEXT,
      source TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS document_comments (
      id TEXT PRIMARY KEY,
      documentId TEXT NOT NULL,
      content TEXT NOT NULL,
      tone TEXT,
      ageGroup INTEGER,
      expertiseLevel INTEGER,
      expertiseLabel TEXT,
      usedContext INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (documentId) REFERENCES workspace_nodes(id) ON DELETE CASCADE
    )
  `,
];
