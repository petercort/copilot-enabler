---
on:
  workflow_dispatch:
permissions:
      contents: read
engine: copilot
network:
  allowed:
    - defaults
    - node
tools:
  web-fetch:
  web-search:
safe-outputs:
  create-issue:
  create-agent-session:
---

# feature-upgrade

Search the vscode change log, currently looking at https://code.visualstudio.com/updates/v1_113 for the latest. After updates/* is the latest release, and there are a number of others. You'll have to figure out how to get the available releases, but get the latest release, and based on what contents for customization and usage are there either submit a plan to add or remove features from this extension. 

<!--
## TODO: Customize this workflow

The workflow has been generated based on your selections. Consider adding:

- [ ] More specific instructions for the AI
- [ ] Error handling requirements
- [ ] Output format specifications
- [ ] Integration with other workflows
- [ ] Testing and validation steps

## Configuration Summary

- **Trigger**: Manual trigger
- **AI Engine**: copilot
- **Tools**: web-fetch, web-search
- **Safe Outputs**: create-issue, create-agent-session
- **Network Access**: defaults,node

## Next Steps

1. Review and customize the workflow content above
2. Remove TODO sections when ready
3. Run `gh aw compile` to generate the GitHub Actions workflow
4. Test the workflow with a manual trigger or appropriate event
-->
