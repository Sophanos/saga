# MLP1 Launch Packs (Concrete Defaults)

> Goal: 2-3 launch packs with clear defaults and the same core UI.
> Core loop: canvas -> ambient signals -> reviewed changes -> artifacts -> exports.
> Delivery: project type picker plus AI Template Builder.

## Pack 1: Product

**Default entity types**
- feature, requirement, persona, metric, release, dependency, risk

**Default relationships**
- depends_on, blocks, serves, measures, conflicts_with

**Default artifact tabs**
- Roadmap, Decisions, Risks

**Default widgets (3)**
- PRD -> roadmap timeline
- PRD -> ticket batch (Linear/Jira)
- Stakeholder deck

**Default pulse signals**
- name drift (canonical feature names)
- requirement conflict
- spec staleness vs linked tickets

## Pack 2: Engineering

**Default entity types**
- system, service, API, incident, decision, dependency, runbook

**Default relationships**
- calls, depends_on, owns, breaks, mitigates

**Default artifact tabs**
- Architecture, Decisions, Runbooks

**Default widgets (3)**
- ADR generator + decision log
- Living architecture diagram
- Runbook exporter

**Default pulse signals**
- ADR drift (doc vs system reality)
- dependency cycle risk
- runbook staleness

## Pack 3: Research

**Default entity types**
- claim, evidence, source, author, method, dataset, concept

**Default relationships**
- supports, contradicts, cites, extends

**Default artifact tabs**
- Evidence Matrix, Outline, Citations

**Default widgets (3)**
- literature matrix
- paper outline compiler
- figure/table generator

**Default pulse signals**
- claim without evidence
- contradictory sources
- missing citations

## Notes

- The registry, default artifact tabs, and widget menu are the only differences.
- The UI stays constant: same canvas, same Inbox, same trails (receipts).
