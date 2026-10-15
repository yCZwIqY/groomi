import type sqlite3 from 'sqlite3';

import type { AiProvider } from '../services/ai-provider.js';

import { all, run } from '../db/connection.js';

export type SettingInfoRow = {
  id: 'default';
  selectedEmbeddingModel: string | null;
  selectedLLMModel: string | null;
  aiProvider?: AiProvider;
  openRouterModel?: string | null;
  aiOutputLanguage?: 'auto' | 'ko' | 'en';
};

export type SettingInfo = {
  selectedEmbeddingModel: string | null;
  selectedLLMModel: string | null;
  aiProvider?: AiProvider;
  openRouterModel?: string | null;
  aiOutputLanguage?: 'auto' | 'ko' | 'en';
};

type TableInfoRow = {
  name: string;
};

const DEFAULT_SETTING_ID = 'default';

export function createSettingRepository(db: sqlite3.Database) {
  async function ensureSettingInfoColumns() {
    const columns = await all<TableInfoRow>(db, 'PRAGMA table_info(setting_info)');
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('selectedEmbeddingModel')) {
      await run(db, 'ALTER TABLE setting_info ADD COLUMN selectedEmbeddingModel TEXT');
    }

    for (const column of ['aiProvider', 'openRouterModel', 'aiOutputLanguage']) {
      if (!columnNames.has(column))
        await run(db, `ALTER TABLE setting_info ADD COLUMN ${column} TEXT`);
    }

    if (!columnNames.has('selectedLLMModel')) {
      await run(db, 'ALTER TABLE setting_info ADD COLUMN selectedLLMModel TEXT');
    }
  }

  return {
    async findSettingInfo(): Promise<SettingInfo> {
      await ensureSettingInfoColumns();

      const rows = await all<SettingInfoRow>(
        db,
        'SELECT id, selectedEmbeddingModel, selectedLLMModel, aiProvider, openRouterModel, aiOutputLanguage FROM setting_info WHERE id = ?',
        [DEFAULT_SETTING_ID],
      );

      return {
        selectedEmbeddingModel: rows[0]?.selectedEmbeddingModel ?? null,
        selectedLLMModel: rows[0]?.selectedLLMModel ?? null,
        aiProvider: rows[0]?.aiProvider === 'openrouter' ? 'openrouter' : 'ollama',
        openRouterModel: rows[0]?.openRouterModel ?? null,
        aiOutputLanguage:
          rows[0]?.aiOutputLanguage === 'ko' || rows[0]?.aiOutputLanguage === 'en'
            ? rows[0].aiOutputLanguage
            : 'auto',
      };
    },

    upsertSettingInfo(settingInfo: SettingInfo) {
      return ensureSettingInfoColumns().then(() =>
        run(
          db,
          `
            INSERT INTO setting_info (id, selectedEmbeddingModel, selectedLLMModel, aiProvider, openRouterModel, aiOutputLanguage)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              selectedEmbeddingModel = excluded.selectedEmbeddingModel,
              selectedLLMModel = excluded.selectedLLMModel,
              aiProvider = excluded.aiProvider,
              openRouterModel = excluded.openRouterModel,
              aiOutputLanguage = excluded.aiOutputLanguage
          `,
          [
            DEFAULT_SETTING_ID,
            settingInfo.selectedEmbeddingModel,
            settingInfo.selectedLLMModel,
            settingInfo.aiProvider ?? 'ollama',
            settingInfo.openRouterModel ?? null,
            settingInfo.aiOutputLanguage ?? 'auto',
          ],
        ),
      );
    },

    updateSelectedEmbeddingModel(selectedEmbeddingModel: string | null) {
      return ensureSettingInfoColumns().then(() =>
        run(
          db,
          `
            INSERT INTO setting_info (id, selectedEmbeddingModel)
            VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET
              selectedEmbeddingModel = excluded.selectedEmbeddingModel
          `,
          [DEFAULT_SETTING_ID, selectedEmbeddingModel],
        ),
      );
    },

    async updateOutputLanguage(language: 'auto' | 'ko' | 'en') {
      await ensureSettingInfoColumns();
      await run(
        db,
        'INSERT INTO setting_info (id, aiOutputLanguage) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET aiOutputLanguage = excluded.aiOutputLanguage',
        [DEFAULT_SETTING_ID, language],
      );
    },

    async updateAiSettings(aiProvider: AiProvider, openRouterModel: string | null) {
      await ensureSettingInfoColumns();
      await run(
        db,
        `INSERT INTO setting_info (id, aiProvider, openRouterModel)
        VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET
        aiProvider = excluded.aiProvider, openRouterModel = excluded.openRouterModel`,
        [DEFAULT_SETTING_ID, aiProvider, openRouterModel],
      );
    },

    updateSelectedLLMModel(selectedLLMModel: string | null) {
      return ensureSettingInfoColumns().then(() =>
        run(
          db,
          `
            INSERT INTO setting_info (id, selectedLLMModel)
            VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET
              selectedLLMModel = excluded.selectedLLMModel
          `,
          [DEFAULT_SETTING_ID, selectedLLMModel],
        ),
      );
    },
  };
}
