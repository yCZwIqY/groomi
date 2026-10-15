import errors from '../../electron/common/locales/errors-en.json';
import type { TranslationTree } from './ko';

export const en = {
  tasks: {
    retry: 'Retry',
    cost: {
      label: 'Cost',
      unavailable: 'Unavailable',
      requests: 'Requests (including retries)',
      partial: 'Some cost data is missing. Only reported charges are shown.',
    },
  },
  settings: {
    displayLanguage: 'Display language',
    languagesDescription: 'Choose the interface language and the language of AI-generated content.',
    title: 'Settings',
    description: 'Manage your workspace and AI preferences.',
    language: 'Language',
    languageDescription: 'Choose the display language.',
  },
  workroom: {
    title: 'Workroom',
    description: 'Continue recent work or start something new.',
    startNew: 'Start new work',
    workspaceCountLabel: 'Workspaces',
    documents: 'Documents',
    recent: {
      title: 'Recent work',
      description: 'Your most recently edited items.',
      empty: 'No recent work yet. Create your first document.',
    },
    workspaces: {
      title: 'Recently created workspaces',
      description: 'Quickly access your new workspaces.',
      empty: 'No workspaces yet.',
    },
    loading: 'Loading workspaces…',
  },
  navigation: {
    home: 'Home',
    expandSidebar: 'Expand sidebar',
    collapseSidebar: 'Collapse sidebar',
    addItem: 'Add a document or group',
  },
  common: {
    collapse: 'Collapse',
    expand: 'Expand',
  },
  backup: {
    reminder: {
      label: 'Manuscript backup reminder',
      error: 'Check your backup history',
      title: 'Back up your manuscripts',
      overdue: 'Your last backup was over a week ago. Save a copy of your recent work elsewhere.',
      first:
        'This workspace has no backups yet. Create your first backup to protect your manuscripts.',
    },
    lastBackup: 'Last backup',
    openSettings: 'Open backup settings',
  },
  date: {
    unavailable: 'Date unavailable',
  },
  ai: {
    outputLanguage: {
      title: 'AI output language',
      description:
        'Choose the language for reviews, summaries and comments independently of the interface.',
      auto: 'Match manuscript (detect Korean or English)',
      groupNote:
        'Applies to new stories. Each story’s language is fixed at its first AI request. Existing generated information takes precedence. Detection supports Korean and English only and defaults to English when uncertain.',
      loadError: 'Could not load the output language. Reopen Settings to retry.',
      saveError: 'Could not save the output language. Please try again.',
    },
  },
  errors,
} satisfies TranslationTree;
