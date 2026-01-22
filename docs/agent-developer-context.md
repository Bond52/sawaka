# Agent Developer Context

## 1. Purpose

This document defines how AI agents are used within the Sawaka project and establishes
clear collaboration rules between human contributors and AI-assisted tools.

The objective is to ensure that AI usage:
- improves development efficiency and quality,
- remains transparent and supervised,
- preserves human responsibility and governance,
- aligns with open-source and ethical best practices.

This document applies to all contributors and all AI-assisted activities within the project.

---

## 2. Definition of an AI Agent

In the context of Sawaka, an **AI agent** refers to any software system or tool that:
- assists in generating code, documentation, tests, or analyses,
- operates based on machine learning or large language models,
- provides suggestions or automated outputs that may influence development.

Examples include (but are not limited to):
- AI-powered code editors (e.g. Cursor),
- documentation or test generation tools,
- CI/CD automation bots with decision logic.

AI agents are considered **assistive tools**, not autonomous actors.

---

## 3. Agent Roles and Responsibilities

### 3.1 Allowed Roles

AI agents may assist with:
- code generation and refactoring suggestions,
- documentation drafting,
- test generation proposals,
- static analysis and linting suggestions,
- exploratory or boilerplate tasks.

### 3.2 Explicitly Disallowed Roles

AI agents must **not**:
- make architectural or product decisions,
- define business priorities or roadmap items,
- modify governance, licensing, or legal documents autonomously,
- approve, merge, or release code,
- act as an author or legal contributor.

All final decisions remain under **human authority**.

---

## 4. Levels of Agent Autonomy

| Activity                               | AI Agent | Human Contributor |
|----------------------------------------|----------|-------------------|
| Suggest code or documentation          | ✅       |                   |
| Modify code locally                    | ⚠️       | ✅ (validation)   |
| Commit changes                         | ❌       | ✅                |
| Review pull requests                   | ❌       | ✅                |
| Merge to protected branches            | ❌       | ✅                |
| Release or deploy                      | ❌       | ✅                |

⚠️ = Allowed only under direct human supervision.

---

## 5. Human Validation and Approval Points

Human contributors are responsible for:
- reviewing all AI-generated outputs,
- validating correctness, security, and relevance,
- ensuring alignment with Sawaka’s goals and standards.

Mandatory human validation is required:
- before any commit,
- before any pull request merge,
- before releases or deployments,
- before changes affecting users, governance, or data.

Responsibility **cannot be delegated** to AI agents.

---

## 6. Usage Guidelines

Contributors using AI tools must ensure that:
- AI assistance is transparent and traceable,
- outputs are critically reviewed and understood,
- no sensitive or private data is shared with AI tools without authorization,
- AI-generated content complies with the project license.

AI usage should **augment**, not replace, human judgment.

---

## 7. Traceability and Transparency

To ensure transparency:
- AI-assisted contributions should be mentioned in pull requests when relevant,
- commit messages may reference AI assistance (e.g. “AI-assisted refactor”),
- code ownership and accountability remain human.

AI agents are not listed as contributors.

---

## 8. Risks and Constraints Related to Agent Autonomy

Identified risks include:
- incorrect or hallucinated outputs,
- security vulnerabilities,
- misinterpretation of domain or cultural context,
- over-automation leading to loss of understanding.

Mitigation strategies:
- systematic human review,
- limited agent autonomy,
- clear scope boundaries,
- progressive adoption of automation.

---

## 9. Governance Principles

- AI agents are tools, not decision-makers.
- Humans retain full responsibility for outcomes.
- Governance rules apply regardless of the AI tool used.
- This document may evolve through community discussion and pull requests.

---

## 10. Evolution and Tool Independence

This context is **tool-agnostic**:
- current AI tools may change,
- future agents may be introduced,
- the rules defined here remain applicable.

Any significant change in AI usage must be documented and reviewed.

---

## 11. Document Maintenance

This document is maintained as part of the Sawaka repository.
Proposed changes must follow the standard contribution and review process.

Last updated: 2026-01-21
