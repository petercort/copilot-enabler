import { defineFeature } from './definition';

export const contextProblems = defineFeature({
  id: 'context-problems',
  name: '#problems Variable',
  category: 'Chat',
  description:
    'Reference current errors and warnings from the Problems panel in chat.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
  detectHints: ['#problems'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Type #problems in chat to include current workspace diagnostics in the conversation.',
  ],
  tutorialPrompt: `I'd like to learn about the #problems variable in GitHub Copilot Chat and how to use it for debugging.

Please help me understand this feature by:
1. Explaining what the #problems variable does and why it's useful when you have errors or warnings
2. Showing me how to use #problems in chat to get help fixing:
   - Linting errors (style, naming conventions, etc.)
   - Type errors or incompatibilities
   - Build warnings
3. Demonstrating how Copilot can provide targeted fixes when it sees your actual error messages
4. Showing workflows where #problems is most useful:
   - When you have multiple errors and need help prioritizing them
   - When you're not sure what an error message means
   - When you want Copilot to suggest fixes for all problems at once
5. Tips for describing additional context around the problems for better solutions

Make examples specific to my current project and its actual errors if any exist.`,
});
