import { defineFeature } from '../definition';

export const customAgentSkills = defineFeature({
  id: 'custom-agent-skills',
  name: 'Agent Skills',
  category: 'Customization',
  description:
    'Create Agent Skills (SKILL.md) directories to define reusable, portable capabilities that include instructions, scripts, and resources for specialized workflows.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/customization/agent-skills',
  detectHints: [
    '.github/skills/**/*.md',
    '.agents/skills/**/*.md',
    '.claude/skills/**/*.md',
    'copilot.tools',
    'agent-skill',
  ],
  impact: 'high',
  difficulty: 'high',
  setupSteps: [
    'Create a `.github/skills/<skill-name>/SKILL.md` file with YAML frontmatter (name, description, argument-hint, user-invokable, disable-model-invocation).',
    'Optionally include scripts, examples, and resources alongside `SKILL.md` in the skill directory.',
    'Invoke skills as slash commands in chat (type `/` to see available skills) or let Copilot load them automatically based on relevance.',
  ],
  systemPrompt: `You are helping create an Agent Skill directory containing a SKILL.md and any supporting scripts or examples.

Your workflow:
1. Inspect the workspace with list_directory and read_file to understand the project and where skills should live.
2. Ask what specialized capability the user wants (testing, debugging, API tasks, deployment automation).
3. Create a skill directory under .github/skills/ with a SKILL.md file containing YAML frontmatter (name, description, argument-hint, user-invokable, disable-model-invocation) and a clear body of instructions and examples.
4. Add any helper scripts or example files in the skill directory and reference them with relative links in the SKILL.md body.
5. Use write_file to create each file and show example usage as a slash command (e.g., '/webapp-testing').

Start by understanding the project and proposing 1-2 concrete skill ideas.`,
  tutorialPrompt: `I'd like to learn about Custom Agent Skills and how I can extend what Copilot can do in my workspace.

Please help me understand this feature by:
1. First, examining my workspace to understand what kind of project I have and what tools/APIs I might interact with
2. Asking me about repetitive tasks or operations I perform that could be automated (e.g., database queries, API calls, running scripts, deployment commands)
3. Based on my responses, suggest 2-3 specific custom skills that would be valuable for my workflow, such as:
   - A skill to query my database schema or run specific queries
   - A skill to interact with my project's API
   - A skill to trigger deployment or build processes
   - A skill to fetch data from external services I use
4. For each suggested skill:
   - Explain what it would do and when I'd use it
   - Show me how I would invoke it in Copilot Chat
   - Explain whether it would use a .prompt.md tool definition or an MCP server
5. Walk me through a concrete example of how one of these skills would work in practice

Please tailor this to my actual project - understand what I'm building and what would genuinely help me.`,
});
