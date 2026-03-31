#!/bin/bash
# Detects when a skill is invoked by the agent.
# Valid dir's include .github/skills/, .claude/skills/, .agents/skills/, .copilot/skills/, or copilot-skill: URIs.
# Prints to the vscode output console. 
# Toggle the bottom planel with Cmd+J, select Output, then GitHub Copilot Chat Hooks in the dropdown to the right of the Filter bar

set -euo pipefail
INPUT=$(cat)

# Grab tool name, if it's not read_file exit
TOOL_NAME=$(echo "$INPUT" | jq -r '(.tool_name)')

if [[ "$TOOL_NAME" != "read_file" ]]; then
  exit 0
fi

# parse out the file path of the file read.
FILE_PATH=$(echo "$INPUT" | jq -r  .tool_input.filePath)

# Match skill files in known skill directories or copilot-skill: URIs
if echo "$FILE_PATH" | grep -qiE '(\.github/skills/|\.claude/skills/|\.agents/skills/|\.copilot/skills/|copilot-skill:)'; then
  FILE_NAME=$(basename "$FILE_PATH")
  # Surface skill file name as a system message in the chat
  echo "{\"systemMessage\":\"[Hook] Skill invoked: $FILE_NAME\"}"
fi


