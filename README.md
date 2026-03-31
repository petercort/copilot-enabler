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
| **Core** | Ask Mode, Agent Mode, Plan Mode, Chat Panel, Run Subagent, Background Agents, Cloud Agents, Inline Chat, Quick Chat, Smart Actions, Multi-line Completions, Next Edit Suggestions (NES), Model Selection |
| **Tools** | @workspace Participant, @terminal, @vscode Participant, #terminalSelection Variable, #codebase Variable, #problems Variable, Web Search, #Changes |
| **Customization** | Custom Instructions File, Reusable Prompt Files, Agent Skills, Custom Agents, MCP Servers, Hooks |

### 🏆 Prioritized Recommendations

Recommendations are ranked using an **Impact × Difficulty matrix** so the highest-value, lowest-effort items ("quick wins") surface first — each with a star rating (★★★ → ☆☆☆).

### 🤖 Personalized Interactive Implementation & Tutorials

Click **Set up** on any supported recommendation and Copilot Enabler opens a **Copilot Chat session** with a tailored prompt that:

1. Reads your project structure and context
2. Asks clarifying questions
3. Generates and writes the configuration files for you

Click **Show Me** on any feature to open a guided **tutorial walkthrough** in Copilot Chat that reads your project structure and explains how the feature works and how to use it.

---

## 🚀 Getting Started

1. **Install** the extension from the VS Code Marketplace (or build from source).
2. **Open a workspace** — the extension activates automatically and runs a background scan.
3. **Check the status bar** — look for `$(pulse) Copilot: --/100` in the bottom-right corner.
4. **Run a full analysis** — open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and select:
   ```
   Copilot Enabler: Run Full Analysis
   ```
5. **Browse results** — explore the sidebar tree views, dashboard, and recommendations.
6. **Implement a recommendation** — click the 💡 icon on any implementable recommendation or run:
   ```
   Copilot Enabler: Implement Recommendation
   ```

> **Tip:** The extension also includes a **Getting Started walkthrough** — search "Maximize Your Copilot Usage" in the walkthroughs panel.

---

## 📋 Commands

| Command | Description |
|---|---|
| `Copilot Enabler: Run Full Analysis` | Scan settings, workspace, extensions, and logs — display the dashboard |
| `Copilot Enabler: Refresh Analysis` | Re-scan in the background and update views |
| `Copilot Enabler: Scorecard` | Open the dashboard focused on the feature adoption matrix |
| `Copilot Enabler: Browse Feature Catalog` | Focus the Feature Catalog tree view in the sidebar |
| `Copilot Enabler: Implement Recommendation` | Interactively implement a recommendation via Copilot Chat |
| `Copilot Enabler: Show Me Tutorial` | Open a guided tutorial for a feature via Copilot Chat |
| `Copilot Enabler: Hide Feature` | Hide a feature from analysis and recommendations |
| `Copilot Enabler: Unhide Feature` | Restore a previously hidden feature |
| `Copilot Enabler: Reset Hidden Features` | Restore all hidden features at once |
| `Copilot Enabler: Settings` | Open the Copilot Enabler settings panel |

---

## 🔎 What Gets Scanned

The extension analyzes four data sources — all **local and read-only** (nothing is sent externally):

| Source | What It Checks |
|---|---|
| **VS Code Settings** | `github.copilot.*`, `github.copilot-chat.*`, `editor.inlineSuggest.*` configuration keys |
| **Workspace Files** | `.github/copilot-instructions.md`, `.vscode/mcp.json`, `.github/prompts/*.prompt.md`, `.github/instructions/*`, `.github/skills/*`, `.github/hooks/*` |
| **Extensions** | Installed extensions — Copilot Core, Copilot Chat, MCP-related, chat participants |
| **Copilot Logs** | VS Code Copilot log files scanned for feature usage hints (completions, modes, participants, etc.) |

---

## 📄 License

[MIT](LICENSE)
