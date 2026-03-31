import { defineFeature } from '../definition';

export const customPromptFiles = defineFeature({
  id: 'custom-prompt-files',
  name: 'Reusable Prompt Files',
  category: 'Customization',
  description:
    'Create .prompt.md files to define reusable, shareable prompt templates for common tasks.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/customization/prompt-files',
  detectHints: ['.github/prompts/*.md', '.prompt.md'],
  impact: 'high',
  difficulty: 'medium',
  setupSteps: [
    'Create a .github/prompts/ directory in your repository or a prompts folder in your VS Code profile for user-level prompts.',
    'Add .prompt.md files with YAML front-matter (name, description, agent/mode, tools, argument-hint) and a Markdown body containing the prompt.',
    'Invoke prompt files from chat using `/` followed by the prompt name, use the editor play button, or run the Chat: Run Prompt command.',
    'Configure additional prompt locations with the `chat.promptFilesLocations` setting.',
  ],
  systemPrompt: `You are helping create reusable .prompt.md files for Copilot workflows.

Your workflow:
1. Use list_directory and read_file to understand the project.
2. Ask what common tasks they want prompt templates for (code review, docs, testing, refactoring).
3. For each prompt, generate a .prompt.md with YAML front-matter (mode, tools) and prompt body.
4. Use write_file to create each file in '.github/prompts/' or your profile prompts folder.

Example front-matter:
---
name: create-react-form
description: Generate a React form component based on project conventions
agent: agent
tools: ["read_file", "write_file"]
argument-hint: "formName"
---

Start by understanding the project, then ask what prompts they want.`,
  tutorialPrompt: `I'd like to learn about Reusable Prompt Files and how they can streamline my common development tasks.

Please help me understand this feature by:
1. First, examining my workspace to understand what kind of project I have and what development tasks I do regularly
2. Explaining what .prompt.md files are and how they differ from just typing prompts into Copilot Chat
3. Asking me about repetitive tasks or workflows I do often, such as:
   - Code reviews with specific criteria
   - Writing tests following certain patterns
   - Generating documentation in a specific format
   - Refactoring code following team conventions
   - Creating components following architectural patterns
4. Based on my responses, suggest 3-4 reusable prompt files that would save me time:
   - What each prompt would do
   - What mode it would run in (ask/edit/agent)
   - What tools it would need access to
   - The /command I'd use to invoke it
5. For each suggested prompt, show me:
   - A concrete example of when I'd use it
   - What the .prompt.md file would look like (front-matter + prompt body)
   - How it would be tailored to my specific project and conventions
6. Walk me through creating one prompt file that would be most useful for my workflow

Please make this specific to my actual codebase - understand what I'm building and what patterns would genuinely help.`,
});
