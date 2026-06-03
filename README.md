# Copilot Enabler

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/PeterCort.copilot-enabler?link=vscode%3A%2F%2FPeterCort.copilot-enabler)

**Analyze and improve your GitHub Copilot adoption.** Discover unused features, get actionable recommendations, and implement them interactively — all from within VS Code.

---

## ✨ Features

### 📊 Adoption Scorecard

Get an instant snapshot of your Copilot usage with an overall adoption score (0–100), feature detection counts, and log analysis — displayed in the **status bar**, a **webview dashboard**, and **sidebar tree views**.

Includes Copilot features organized across three categories:

| Category | Features |
|---|---|
| **Core** | Agent Mode, Cloud Agents, Multi-line Completions, Model Selection |
| **Tools** | #terminal, #codebase, #web, /chronicle|
| **Customization** | Custom Instructions File, Agent Skills, Custom Agents, MCP Servers, Hooks |

### 🏆 Prioritized Recommendations

Recommendations are ranked using an **Impact × Difficulty matrix** so the highest-value, lowest-effort items ("quick wins") surface first — each with a star rating (★★★ → ☆☆☆).

### 🤖 Personalized Interactive Implementation & Tutorials

Click **Show me** on any supported recommendation and Copilot Enabler opens a **Copilot Chat session** with a tailored prompt that will show you how to use the feature within the context of your own repository. 

Click **Set up** on any supported recommendation and Copilot Enabler opens a **Copilot Chat session** with a tailored prompt that:

1. Reads your project structure and context
2. Asks clarifying questions
3. Generates and writes the configuration files for you

---

## 🚀 Getting Started

1. **Install** the extension from the VS Code Marketplace (or build from source).
2. **Open a workspace** — the extension activates automatically and runs a background scan.
3. **Check the status bar** — look for `$(pulse) Copilot: --/100` in the bottom-right corner and click to open the score card.
4. **Browse results** — explore the sidebar tree views, dashboard, and recommendations.
5. **Implement a recommendation** — click the 💡 icon on any implementable recommendation or run:
   ```
   Copilot Enabler: Implement Recommendation
   ```

> **Tip:** The extension also includes a **Getting Started walkthrough** — search "Maximize Your Copilot Usage" in the walkthroughs panel.

---

## 📋 Commands

| Command | Description |
|---|---|
| `Copilot Enabler: Run Full Analysis` | Scan settings, workspace, extensions, and logs — display the dashboard |
| `Copilot Enabler: Scorecard` | Open the dashboard focused on the feature adoption matrix |
| `Copilot Enabler: Implement Recommendation` | Interactively implement a recommendation via Copilot Chat |
| `Copilot Enabler: Show Me Tutorial` | Open a guided tutorial for a feature via Copilot Chat |
| `Copilot Enabler: Settings` | Open the Copilot Enabler settings panel |

---

## 🔎 What Gets Scanned

The extension analyzes four data sources — all **local and read-only** (nothing is sent externally):

| Source | What It Checks |
|---|---|
| **VS Code Settings** | `github.copilot.*`, `github.copilot-chat.*`, `editor.inlineSuggest.*` configuration keys |
| **Workspace Files** | `.github/copilot-instructions.md`, `.vscode/mcp.json`, `.github/prompts/*.md`, `.github/agents/*.agent.md`, `.github/instructions/*`, `.github/skills/*`, `.github/hooks/*`, and equivalent user setting paths (like `~/.claude/settings.json`) |
| **Extensions** | Installed extensions — Copilot Core, Copilot Chat, MCP-related, chat participants |
| **Copilot Logs** | VS Code Copilot log files scanned for feature usage hints (completions, modes, participants, etc.) |

---

## 📄 License

[MIT](LICENSE)
