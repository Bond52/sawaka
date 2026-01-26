## Business Analysis Information Management – Sawaka

### Purpose
This document defines how Business Analysis (BA) information is structured, stored, and evolved within the Sawaka project.  
It establishes a clear separation between decision artefacts (requirements, change requests) and delivery artefacts (user stories, tasks), ensuring traceability, transparency, and long-term maintainability in an open-source context.

---

### Artefact Types
Sawaka uses the following Business Analysis artefacts:

- **Requirements**
  - Functional (FR), Non-Functional (NFR), and Business Requirements (BR)
  - Managed in the *Sawaka — Requirements Management* project
  - Represent validated needs and constraints

- **User Stories**
  - Managed in the *Sawaka — Product Backlog*
  - Represent implementation commitments derived from approved requirements

- **Change Requests**
  - Used to propose modifications to existing requirements or scope
  - Assessed through impact analysis and governance workflow

- **BRD References**
  - Serve as source documents for requirements
  - Referenced from requirements but not duplicated

- **Visual Models**
  - UX designs and conceptual models maintained in Figma or modeling tools
  - Linked from requirements or user stories when relevant

---

### Tools & Formats
The following tools and formats are used consistently across the project:

- **Markdown**
  - Primary format for textual analysis and documentation
  - Used in GitHub issues and repository documentation

- **GitHub Issues & Projects**
  - Used to manage the lifecycle of BA artefacts
  - Provide traceability, versioning, and visibility

- **Figma**
  - Used for visual artefacts such as UX flows and interface designs
  - Visual artefacts are referenced via links and remain external to the repository

---

### Traceability
Traceability is ensured through explicit linking between artefacts:

- Requirements reference:
  - source BRD documents
  - related user stories
  - relevant visual artefacts

- User stories reference:
  - one or more approved requirements

This approach enables bidirectional traceability without duplicating information across artefacts.

---

### Governance & Change
Changes to Business Analysis information follow a defined governance process:

- New requirements and change requests are assessed through impact analysis
- Decisions are recorded using explicit lifecycle states (e.g. Proposed, Impact Assessed, Decision Pending, Approved, Deferred)
- Only approved requirements may generate user stories in the Product Backlog

This governance model ensures that delivery activities are always grounded in validated decisions.

---

### Visibility
Visibility of BA information is managed intentionally:

- Business Analysis workflows, decisions, and artefact relationships are publicly visible
- Drafts, intermediate analyses, and contextual discussions remain within their respective artefacts
- No explicit performance scoring or individual evaluation is exposed

This balance supports transparency for contributors and stakeholders while avoiding unnecessary noise or misinterpretation.
