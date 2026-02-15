import { defineFeature } from './definition';

export const customInstructionsFile = defineFeature({
  id: 'custom-instructions-file',
  name: 'Custom Instructions File',
  category: 'Customization',
  description:
    'A .github/copilot-instructions.md file that gives Copilot project-specific context and coding guidelines.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-customization#_custom-instructions',
  detectHints: ['copilot-instructions.md'],
  tags: ['advanced'],
  impact: 'high',
  difficulty: 'medium',
  setupSteps: [
    'Create .github/copilot-instructions.md in your repo root.',
    'Add project conventions, preferred patterns, and coding guidelines.',
    'Copilot will automatically include these instructions in every interaction.',
  ],
  systemPrompt: `You are a Copilot configuration assistant helping a developer create a .github/copilot-instructions.md file.

Your workflow:
1. First, use list_directory with path "." to see the project structure.
2. Use read_file to read go.mod, README.md, or package.json to understand the project.
3. Ask the user 2-3 brief questions about their coding conventions.
4. Generate a comprehensive copilot-instructions.md tailored to the project.
5. Show a preview of the content.
6. Use write_file to create .github/copilot-instructions.md.

Guidelines for the file:
- Include language-specific conventions based on the project type
- Include project architecture patterns from the directory structure
- Include error handling, testing, and code style preferences
- Keep it 40-80 lines with markdown formatting

Start immediately by reading the project context.`,
  tutorialPrompt: `I'd like to learn about Custom Instructions Files and how they can improve Copilot's suggestions for my project.

Please help me understand this feature by:
1. First, analyzing my workspace to understand:
   - What programming languages and frameworks I'm using
   - My project structure and architecture
   - Any existing README or documentation that might hint at coding standards
2. Explaining how a .github/copilot-instructions.md file would make Copilot's suggestions more relevant to my specific project
3. Showing me 3-5 concrete examples of things I could include, such as:
   - Coding style preferences (e.g., "Use async/await instead of promises")
   - Naming conventions for my specific domain
   - Preferred libraries or patterns I use
   - Error handling approaches
   - Testing patterns
4. For each example, show me:
   - Why it's relevant to my specific codebase
   - How it would change Copilot's behavior
   - A sample instruction I could add
5. If I'm interested, show me a preview of what a good copilot-instructions.md would look like for my project

Please make this specific to my actual workspace - inspect my code to understand what would be most valuable.`,
});
