import { defineFeature } from './definition';

export const webSearch = defineFeature({
  id: 'web-search',
  name: 'Web Search',
  category: 'Chat',
  description: 'Fetch information from the web',
  docsURL: 'https://code.visualstudio.com/docs/copilot/reference/copilot-vscode-features#_chat-tools',
  detectHints: ['fetch'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'type #fetch in the chat panel and type a URL',
  ],
  tutorialPrompt: `I'd like to learn how to use web search in GitHub Copilot Chat to gather external information.

Please help me understand this feature by:
1. Explaining what web search enables in Copilot Chat:
   - When you should use #fetch to bring in web content
   - How Copilot integrates fetched information with your question
   - Privacy and security considerations
2. Practical use cases for web search:
   - Looking up API documentation while coding
   - Understanding framework updates or best practices
   - Researching error messages or unknown tools
   - Finding code examples for unfamiliar patterns
3. How to use #fetch effectively:
   - Structuring your question to use fetched content
   - Asking Copilot to explain or adapt web content for your project
   - Combining web search with your codebase context
4. Examples in my workflow:
   - Documentation lookup for libraries I use
   - Framework-specific answers
5. Alternatives to web search (like #codebase context)

Show me real examples with actual URLs relevant to my tech stack.`,
});
