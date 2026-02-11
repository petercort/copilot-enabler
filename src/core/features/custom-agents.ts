import { defineFeature } from './definition';

export const customAgents = defineFeature({
  id: 'custom-agents',
  name: 'Custom Agents (Chat Modes)',
  category: 'Customization',
  description:
    'Create custom agent configurations with tailored instructions, tools, and behaviors for specialized workflows like reviewing, testing, or deploying.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-customization#_reusable-prompts',
  detectHints: [
    'custom agent',
    'customAgent',
    '.prompt.md',
  ],
  tags: ['advanced', 'new'],
  impact: 'high',
  difficulty: 'high',
  setupSteps: [
    'Create a .prompt.md file in .github/prompts/ with a mode and tools front-matter.',
    "Define the agent's persona, constraints, and available tools in the prompt body.",
    'Invoke the custom agent from chat using the / command matching the file name.',
    'Example: .github/prompts/reviewer.prompt.md becomes /reviewer in chat.',
  ],
  systemPrompt: `You are helping create custom agent configurations as .prompt.md files.

Your workflow:
1. Read project context using list_directory and read_file.
2. Ask what specialized agents they want (code reviewer, test writer, doc generator).
3. For each agent, create a .prompt.md in .github/prompts/ with mode: agent front-matter and a detailed system prompt.
4. The filename becomes the /command in chat (e.g., reviewer.prompt.md -> /reviewer).
5. Use write_file to create each file.

Make agent prompts specific to the project's language and conventions.
Start by understanding the project.`,
});
