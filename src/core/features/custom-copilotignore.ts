import { defineFeature } from './definition';

export const customCopilotignore = defineFeature({
  id: 'custom-copilotignore',
  name: '.copilotignore File',
  category: 'Customization',
  description:
    "Exclude specific files or directories from Copilot's context and suggestions.",
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-customization',
  detectHints: ['.copilotignore'],
  tags: ['advanced', 'enterprise'],
  impact: 'medium',
  difficulty: 'medium',
  setupSteps: [
    'Create a .copilotignore file in your repo root.',
    'Use .gitignore syntax to list files/patterns to exclude.',
  ],
  systemPrompt: `You are helping create a .copilotignore file to exclude files from Copilot's context.

Your workflow:
1. Use list_directory with path "." to see the project structure.
2. Check if .gitignore exists by trying read_file.
3. Identify files to exclude (build outputs, vendor, generated files, secrets).
4. Show the user what you plan to exclude and ask for adjustments.
5. Use write_file to create .copilotignore.

Start immediately by reading the project structure.`,
  tutorialPrompt: `I'd like to learn about .copilotignore files and how they can improve Copilot's performance and security in my workspace.

Please help me understand this feature by:
1. First, scanning my workspace to identify:
   - Build output directories (dist/, build/, out/, etc.)
   - Dependency directories (node_modules/, vendor/, etc.)
   - Generated or minified files
   - Large data files or assets
   - Configuration files that might contain sensitive information
2. Explaining why excluding these files would:
   - Make Copilot's suggestions faster and more relevant
   - Reduce the risk of exposing sensitive data
   - Focus Copilot on my actual source code
3. Showing me what you found in my workspace that should probably be excluded
4. For each category of files you found, explain:
   - Why it should be excluded
   - What pattern would match it in .copilotignore
   - How it would improve my Copilot experience
5. If I have a .gitignore file, explain how .copilotignore differs and what I might want to exclude beyond what's in .gitignore

Show me a preview of what a good .copilotignore would look like for my specific project.`,
});
