# write a scirpt to log tool usage form the AI 
# the script should read the prerun.json file to get the list of tools to log, and then log the usage of those tools to a file called audit.log in the .github/hooks directory
#!/bin/bash
# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Read the prerun.json file to get the list of tools to log
TOOLS=$(jq -r '.hooks.PreToolUse[] | select(.type == "command")

.command' "$SCRIPT_DIR/prerun.json")
# Log the usage of the tools to the audit.log file
for TOOL in $TOOLS; do

  echo "$(date): Used tool - $TOOL" >> "$SCRIPT_DIR/audit.log"
done
