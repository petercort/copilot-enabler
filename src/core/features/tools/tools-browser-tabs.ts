import { defineFeature } from '../definition';

export const toolsBrowserTabs = defineFeature({
  id: 'tools-browser-tabs',
  name: 'Browser Tab Sharing with Agents',
  category: 'Tools',
  description:
    'Share integrated browser tabs with Copilot agents so they can inspect, interact with, and validate live pages while iterating on web changes.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/guides/browser-agent-testing-guide',
  detectHints: [],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Open your app in VS Code\'s integrated browser.',
    'Attach the browser tab to chat using suggested context, the context picker, or drag and drop.',
    'Approve agent requests to share an open page when prompted so the agent can interact with it.',
    'Use the browser\'s sharing control to stop sharing once validation is complete.',
  ],
  addedIn: '1.119.0',
});
