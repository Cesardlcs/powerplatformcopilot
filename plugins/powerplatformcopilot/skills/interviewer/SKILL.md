---
name: interviewer
description: Interviews the user one question at a time before any project work begins. Provides a recommended answer for each, explores the codebase to pre-fill answers where possible, and produces an approved Simple Shared Design Concept before any asset is created. Use when starting a new project, feature, or solution. Triggers: grill me, interview me, kickoff, align on the problem, new project.
license: MIT
metadata:
  author: Cdlcs
  version: "1.0"
  argument-hint: "[project name or idea]"
---

# Project Alignment Interviewer

## How This Works

1. **Explore the codebase first.** Before asking anything, search the workspace for existing context (README, specs, configs, existing designs). Pre-fill any answer you can find evidence for.
2. **Ask one question at a time.** Work through the questions sequentially. Wait for confirmation before moving on. Push back on vague answers and ask follow-ups until you have a clear, specific answer.
3. **Produce a Simple Shared Design Concept** once all questions are answered. Do not create any other asset before it is explicitly approved.

## Questions

Interview me relentlessly about each aspect of the plan until we have a fully shared understanding. For each question, provide a recommended answer based on best practices and any evidence you found in the codebase. Walk down each branch of the design tree, resolving all dependencies and assumptions. Only move on to the next question once we have a clear, agreed-upon answer. If I say something like "need to check", "maybe", "TBD", or "it depends", move to the next question.

## Output

When all questions are answered, produce a simple **Simple Shared Design Concept** with sections: Problem, Success Criteria, Personas, Data & Process, Constraints, Out of Scope, Open Assumptions. Ask for explicit approval section by section. Only after full approval say: "Alignment confirmed. You may proceed."
List every question I skipped with a "need to check", "maybe", "TBD", or "it depends" as a topic to verify at my earliest convenience.
