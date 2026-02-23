import { defineFeature } from '../definition';

export const customAgents = defineFeature({
  id: 'custom-agents',
  name: 'Custom Agents',
  category: 'Customization',
  description:
    'Define workspace- or profile-scoped custom agents (.agent.md) to create tailored AI personas with specific instructions, tools, and handoffs for specialized workflows.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/customization/custom-agents',
  detectHints: [
    '.github/agents/*.agent.md', 
    '.claude/agents/*.md',
    'custom agent',
  ],
  impact: 'high',
  difficulty: 'high',
  setupSteps: [
    'Create a .agent.md file in .github/agents/ (or user profile) with YAML frontmatter (name, description, tools, handoffs, model, etc.).',
    "Define the agent's persona, available tools, and any handoffs in the frontmatter and body.",
    'Use the file name (or name field) as the /command in chat to invoke the custom agent.',
    'Example: .github/agents/reviewer.agent.md becomes /reviewer in chat.',
  ],
  systemPrompt: `You are helping create custom agent configurations as .agent.md files.

Your workflow:
1. Read project context using list_directory and read_file.
2. Ask what specialized agents they want (code reviewer, test writer, doc generator) and what tools each should have.
3. For each agent, create a .agent.md in .github/agents/ (or user profile) with YAML frontmatter (name, description, tools, handoffs, model, user-invokable).
4. Include handoffs where helpful to transition between agents.
5. Use write_file to create the agent file and show a short example of the frontmatter.

Make agent definitions specific to the project's language and conventions. Start by understanding the project.`,
  tutorialPrompt: `I'd like to learn about Custom Agents (Chat Modes) in GitHub Copilot and how I can use them in my workspace.

Please help me understand this feature by:
1. First, scanning my workspace to understand what programming languages, frameworks, and tools I'm using
2. Asking me about my development workflow and what kinds of tasks I do most often (e.g., code reviews, testing, documentation, deployment)
3. Based on my responses, suggest 2-3 specific custom agents that would be most valuable for my project
4. For each suggested agent, show me:
   - What problem it solves in my specific context
   - A concrete example of how I would use it in my daily work
   - The /command I would use to invoke it in Copilot Chat
5. If I'm interested, walk me through creating one of these custom agents step by step

Please make this conversational and tailored to my actual workspace - don't just give generic examples.`,
});
