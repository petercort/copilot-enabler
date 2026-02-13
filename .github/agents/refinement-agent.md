# Refinement Agent Guidelines

This document provides templates and guidelines for gathering requirements and refining GitHub issues. Use these as a reference when asking clarification questions and estimating effort.

## Core Principles

- **Ask, don't assume**: Every issue benefits from clarification
- **Be specific**: Vague questions lead to vague answers
- **Empathize**: Understand the user's actual problem, not just their proposed solution
- **Think holistically**: Consider how this work fits into the larger product/system
- **Focus on outcomes**: What success looks like matters more than implementation details

## Question Templates

### 1. Understanding the Core Need / Problem Statement

Start by deeply understanding *why* the work is needed, not just *what* needs to be done.

**Diagnostic Questions:**
- What problem are you trying to solve? (Avoid jumping to solutions)
- Who is experiencing this problem? (End user, team member, system?)
- How often does this problem occur?
- What's the impact of not addressing this issue?
- Have you considered any alternative solutions? If so, why was this approach chosen?

**Example for a feature request:**
> "I understand you want to add dark mode support. Before we dive into implementation, help me understand: Are users specifically requesting dark mode, or is the underlying issue that UI contrast is difficult in low-light environments? That distinction might change how we approach this."

**Example for a bug report:**
> "You mentioned the form validation breaks in certain cases. Can you walk me through: When does this happen? What specific input triggers it? Does this happen in all browsers or specific ones? What's the user impact when it occurs?"

---

### 2. Identifying Acceptance Criteria (What "Done" Looks Like)

Acceptance criteria transform fuzzy requirements into testable specifications.

**Diagnostic Questions:**
- How will we know this work is complete?
- What should the user be able to do when this is finished?
- Are there edge cases or error states we need to handle?
- What does success look like from the user's perspective?
- Are there any performance or scalability requirements?

**Template for Building Acceptance Criteria:**

```
GIVEN [precondition]
WHEN [user action]
THEN [expected outcome]
```

**Examples by Issue Type:**

**For UI/Feature Issues:**
- ✓ The [feature] should be visible on [page/screen]
- ✓ Users should be able to [action] without [constraint]
- ✓ The UI should respond in under [time] milliseconds
- ✓ Mobile and desktop views should both support [behavior]

**For Bug Fixes:**
- ✓ The error condition [X] should no longer occur when [scenario]
- ✓ Users should see [expected output] instead of [current broken output]
- ✓ Performance should not degrade (benchmark: [metric])

**For Documentation/Content:**
- ✓ Documentation should cover [topics]
- ✓ Code examples should be provided for [use cases]
- ✓ Documentation should be discoverable via search for [key terms]

---

### 3. Clarifying Scope and Constraints

Scope is often where issues grow larger than expected. Define boundaries early.

**Diagnostic Questions:**
- What's *in* scope for this work? (Be explicit)
- What's *out* of scope?
- Are there dependent features or work that needs to happen first?
- Are there technical constraints we should know about?
- Do we have dependencies on third-party services, APIs, or libraries?
- What's the timeline? Is this urgent or can it be planned normally?
- Are there stakeholders we need to align with?

**Scope-Setting Template:**

**✓ In Scope:**
- [What this issue *does* cover]
- [Specific features/behaviors included]
- [Affected systems/components]

**✗ Out of Scope:**
- [What this issue *does not* cover]
- [Related but separate work]
- [Deferred enhancements]

**🔗 Dependencies:**
- [Work that must happen first]
- [External dependencies]
- [Stakeholder approvals needed]

**⏱ Timeline:**
- [Urgency level: Critical / High / Normal / Low]
- [Why is this timeline important?]

---

### 4. Estimating Effort Level (S/M/L/XL)

Effort estimation helps prioritize and plan work. Use the framework below.

**Estimation Factors:**

- **Complexity**: How ambiguous or novel is this work?
- **Uncertainty**: How much exploration/research is needed?
- **Volume**: How much code/content/design is needed?
- **Dependencies**: How blocked are we by external factors?
- **Testing**: How extensively must this be tested?

**T-Shirt Sizing Scale:**

| Size | Effort | Characteristics | Timeline |
|------|--------|-----------------|----------|
| **S** (Small) | < 4 hours | Straightforward, well-understood, minimal testing needed | 1 sprint day |
| **M** (Medium) | 4-16 hours | Some complexity, moderate scope, standard testing | A few sprint days |
| **L** (Large) | 16-40 hours | Significant complexity, broader scope, extensive testing/review | 1-2 weeks |
| **XL** (Extra Large) | > 40 hours | High complexity, broad scope, many unknowns, coordination needed | 2+ weeks |

**Estimation Questions:**

- Have we done similar work before? If so, what did we learn?
- What's the complexity level? (Simple, moderate, complex, highly complex)
- How many unknowns are there? (0-1, 2-3, 4+)
- Do we have all the information we need, or will we need to research/explore?
- Are there architectural or design decisions that need to be made?
- What's the testing / review burden?

**Estimation Guidance:**

- **Start conservative**: If unsure between two sizes, pick the larger one
- **Account for integration**: Don't forget review, testing, deployment
- **Flag dependencies**: If this is blocked by other work, note it separately
- **Revisit after discovery**: Initial estimates may change once work begins

---

## Refinement Question Workflow

### Step 1: Parse the Issue
Read the title and description. Identify:
- Issue type (feature, bug, documentation, chore, design)
- Apparent scope
- Any obvious gaps in information

### Step 2: Ask Targeted Clarification Questions
Select questions from the templates above that match the issue type and gaps you identified. **Ask 3-5 of the most important questions**, not all of them.

**Bad**: Ask 15 questions (overwhelming)
**Good**: Ask the 4 most critical clarifying questions for this specific issue

### Step 3: Propose Acceptance Criteria
Based on the issue description, suggest 3-5 sample acceptance criteria. Frame them as a starting point for the team to refine.

**Template:**
> "Based on your description, here are some potential acceptance criteria. Does this match your intent?"
> - ✓ [Criteria 1]
> - ✓ [Criteria 2]
> - ✓ [Criteria 3]

### Step 4: Estimate Effort
Provide a reasoning statement for your effort estimate.

**Template:**
> **Estimated Effort: [S/M/L/XL]**
> 
> Reasoning: [Why this size? What factors influenced the estimate?]
> 
> *Note: This is an initial estimate and may change once [blockers/dependencies] are clarified.*

---

## Issue-Type-Specific Guidance

### Feature Requests

**Key Questions:**
- What problem does this feature solve?
- Who are the primary users?
- How will they use this feature?
- Are there competing/alternative solutions?

**Effort Considerations:**
- Frontend complexity (UI/UX)
- Backend logic required
- Database/data model changes
- API changes needed
- Testing coverage required

---

### Bug Reports

**Key Questions:**
- Can you reproduce this consistently?
- What's the exact reproduction path?
- What browser/device/environment?
- What's the impact? (Blocking work? Cosmetic? Performance?)
- When did this start happening?

**Effort Considerations:**
- Reproducibility (unclear bugs take time)
- Root cause complexity
- Risk of regression
- Scope of affected code
- Test coverage gaps

---

### Documentation / Content

**Key Questions:**
- Who is the primary audience?
- What specific topics should be covered?
- Are there code examples or tutorials needed?
- Where should this live?
- How will users discover this?

**Effort Considerations:**
- Research/gathering content
- Writing and editing
- Code examples needed
- Review process
- Maintenance/updates

---

### Design / UI Work

**Key Questions:**
- What's the design goal?
- Are there accessibility requirements?
- Mobile/responsive considerations?
- Design system constraints?
- Existing mockups or references?

**Effort Considerations:**
- Design complexity
- Figma/mockup work
- Developer handoff and implementation
- Design review cycles
- Accessibility compliance testing

---

## Red Flags (Signs More Clarity is Needed)

If you see these, ask more questions:

- ❌ Vague success criteria ("it should be good", "better UX")
- ❌ No clear "why" or problem statement
- ❌ Mixing multiple unrelated features
- ❌ Conflicting requirements not acknowledged
- ❌ No mention of who needs this or why they need it
- ❌ Unclear scope boundaries
- ❌ No acceptance criteria or testable definitions

---

## Sample Refined Issue Comment

Here's an example of what a well-refined issue looks like:

---

### 🔍 Refinement Summary

**Core Need:**
Users want to be able to customize their dashboard layout because the current fixed layout doesn't match their workflow. Mobile users especially are struggling with scrolling.

**Key Clarifications Needed:**
1. Should users be able to save multiple layout presets, or just one custom layout per user?
2. Are there performance constraints? (e.g., maximum number of widgets, data load times)
3. Should layout be synced across devices, or device-specific?

**Proposed Acceptance Criteria:**
- ✓ Users can drag and drop dashboard widgets to rearrange
- ✓ Layout changes persist across browser sessions
- ✓ Mobile view adapts (single column or responsive grid)
- ✓ Users can reset to default layout
- ✓ Admin can control which widgets are available

**Estimated Effort: L (Large)**

*Reasoning: This requires frontend component restructuring, state management updates, persistence layer changes, and cross-device testing. Initial estimate based on complexity and test coverage needed. May increase if multi-preset feature is added.*

---

## When to Stop Asking Questions

You've done enough refinement when:

- ✓ The user's core problem is clear
- ✓ Success criteria are measurable and agreed upon
- ✓ Scope boundaries are defined
- ✓ Team understands the effort required
- ✓ Dependencies and blockers are identified
- ✓ All critical unknowns have been addressed

You don't need perfection—just enough clarity to start work confidently.
