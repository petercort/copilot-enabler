# Copilot Enabler

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/PeterCort.copilot-enabler?link=vscode%3A%2F%2FPeterCort.copilot-enabler)

**Analyze and improve your GitHub Copilot adoption.** Discover unused features, get actionable recommendations, and implement them interactively — all from within VS Code.

---

## ✨ Features

### 📊 Adoption Scorecard

Get an instant snapshot of your Copilot usage with an overall adoption score (0–100), feature detection counts, and log analysis — displayed in the **status bar**, a **webview dashboard**, and **sidebar tree views**.

### 🔍 Feature Catalog

Browse all **31 tracked Copilot features** organized across six categories:

| Category | Examples |
|---|---|
| **Modes** | Ask, Edit, Agent |
| **Chat** | Panel, Inline, Quick, @workspace, @terminal, @vscode |
| **Completion** | Inline Suggestions, Next Edit Suggestions (NES), Multi-line |
| **Customization** | Instructions file, .copilotignore, Prompt files, MCP Servers, Custom Agents |
| **Context** | #file, #selection, #codebase, #terminalLastCommand, #problems |
| **Settings** | Model Selection, Suggestion Delay, Inline Suggest config |

### 🏆 Prioritized Recommendations

Recommendations are ranked using an **Impact × Difficulty matrix** so the highest-value, lowest-effort items ("quick wins") surface first — each with a star rating (★★★ → ☆☆☆).

### 🤖 Interactive Implementation

Click **Implement** on any supported recommendation and Copilot Enabler opens a **Copilot Chat session** with a tailored prompt that:

1. Reads your project structure and context
2. Asks clarifying questions
3. Generates and writes the configuration files for you

Supported implementations include:
- `.github/copilot-instructions.md` — project-specific coding guidelines
- `.copilotignore` — exclude files from Copilot's context
- `.github/prompts/*.prompt.md` — reusable prompt templates
- Custom agents and agent skills
- Per-mode instructions (Ask / Edit / Agent)
- `.vscode/mcp.json` — MCP server configuration

### 📝 Export Reports

Generate a full **Markdown adoption report** with scorecard, recommendations, and a feature adoption matrix — perfect for sharing with your team or tracking progress over time.

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
| `Copilot Enabler: Feature Matrix` | Open the dashboard focused on the feature adoption matrix |
| `Copilot Enabler: Browse Feature Catalog` | Focus the Feature Catalog tree view in the sidebar |
| `Copilot Enabler: Export Report` | Save a Markdown adoption report to a file |
| `Copilot Enabler: Implement Recommendation` | Interactively implement a recommendation via Copilot Chat |

---

## 🔎 What Gets Scanned

The extension analyzes four data sources — all **local and read-only** (nothing is sent externally):

| Source | What It Checks |
|---|---|
| **VS Code Settings** | `github.copilot.*`, `github.copilot-chat.*`, `editor.inlineSuggest.*` configuration keys |
| **Workspace Files** | `.github/copilot-instructions.md`, `.copilotignore`, `.vscode/mcp.json`, `.github/prompts/*.prompt.md`, `.github/instructions/*` |
| **Extensions** | Installed extensions — Copilot Core, Copilot Chat, MCP-related, chat participants |
| **Copilot Logs** | VS Code Copilot log files scanned for feature usage hints (completions, modes, participants, etc.) |

---

## 🏗 Architecture

The extension is structured as a port of a Go CLI tool into a native VS Code extension:

```
src/
├── extension.ts              # Entry point — commands, watchers, activation
├── core/
│   ├── analyzer.ts           # Orchestrates agents and computes scores
│   ├── featureCatalog.ts     # 31-feature registry with metadata
│   ├── prompts.ts            # System prompts for interactive implementation
│   ├── report.ts             # Markdown report generator
│   ├── agents/               # Analysis agents (Modes, Customizations, Adoption)
│   └── scanner/              # Data collectors (settings, workspace, extensions, logs)
└── views/
    ├── dashboardPanel.ts     # Webview scorecard dashboard
    ├── featureTreeProvider.ts # Feature Catalog tree view
    ├── recommendationTree.ts  # Recommendations tree view
    └── statusBar.ts          # Status bar widget
```

### Analysis Agents

Three specialized agents evaluate different dimensions of Copilot adoption:

- **ModesAgent** — Are you using Ask, Edit, and Agent modes?
- **CustomizationsAgent** — Have you set up instructions, prompts, MCP, and ignore files?
- **AdoptionAgent** — Full gap analysis across all 31 features with prioritized recommendations

---

## 🛠 Development

```sh
# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run compile

# 3. Package as a .vsix file (install vsce first if you don't have it)
npm install -g @vscode/vsce
vsce package

# 4. Install the generated .vsix in VS Code
code --install-extension copilot-enabler-0.1.0.vsix
```

---

## 📄 License

[MIT](LICENSE)
