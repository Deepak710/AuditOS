# Contributing to AuditOS

Thanks for your interest in AuditOS. This document covers how the codebase is organized, the conventions every change is expected to follow, and how to verify a change before opening a pull request.

Until a license is formally adopted (see [License](README.md#license)), treat contributions as offered under the eventual [Community License](LICENSE-COMMUNITY.md) draft's terms.

## Before You Start

Read [AUDITOS.md](AUDITOS.md) — the canonical engineering reference — before making a non-trivial change. It documents, chapter by chapter, exactly what each platform file is responsible for, which architectural rules are enforced by convention (not tooling), and where the known gaps and extension points already are. A change that duplicates something already documented there, or that violates a rule stated in it, is the most common way a contribution gets sent back for revision.

## Getting Set Up

No installation is required to run the application:

```bash
git clone https://github.com/Deepak710/AuditOS.git
cd AuditOS
# Open prototype/index.html directly in a browser — no build, no server
```

Two Node-based tools are useful for development but are never required to *use* the application:

```bash
node prototype/tests/run-tests.js     # Offline test suite — no browser, no framework
node prototype/tools/validate.js       # Headless-browser DOM/console validation (requires Playwright locally)
```

## The One Rule That Matters Most

**AuditOS renders only what recorded data supports. It never fabricates.** This shows up throughout the codebase as "Design Principles" (Appendix E of AUDITOS.md): JSON is the source of truth, an absent field renders as an honest empty state (`present: false`), never invented content. Any contribution that makes a workspace show data it doesn't actually have — a plausible-looking placeholder, a synthesized summary, a guessed relationship — violates this rule regardless of how good the intent is.

## Architectural Conventions

Every workspace file follows the same pattern, and new workspaces are expected to as well:

**Business → ViewModel → Components → DOM**

- `collectViewModel` is the single place a workspace reads application state, returning a pure, offline-testable derivation.
- The renderer configures the Shared Workspace Framework's slots using compositions from the Enterprise Data Presentation System — never bespoke DOM, never a duplicated component.

Two boundaries are enforced by consistent authorship, not a linter or type system (Release 1 has neither) — please don't be the exception:

1. **`prototype/js/` never depends on `prototype/components/`.** Components render; they never call back into workspace or service code.
2. **Writes always go through the Repository Foundation** (`prototype/js/platform/repository.js`). No workspace or component calls `AuditOS.state`'s write methods directly — every simulated create, update, or remove goes through a repository, without exception. (Reads are a known partial exception today — see AUDITOS.md, Appendix C, entry C.17 — but new code should read through a repository too, not add to that gap.)

## Adding a New Workspace

1. Follow the four-stage shape above.
2. Register it in `prototype/js/router/workspace-registry.js`, declaring its hierarchy scope (platform-flat, client-scoped, or engagement-scoped).
3. If it introduces a new business entity, add it to `repository.js`'s `ENTITIES` catalog *before* writing any code that writes to it.
4. Add tests under `prototype/tests/` following the existing `smoke/`, `unit/`, `integration/` split — suites are auto-discovered from `*.test.js` files.
5. Capture a screenshot for `images/` if the workspace has a meaningful default view, and consider whether `AUDITOS.md` or the README should reference it.

## Testing Expectations

- `node prototype/tests/run-tests.js` must pass at 100% before a pull request is opened. The baseline at v1.0.0 is 919/919.
- `node prototype/tools/validate.js` should report 0 console errors and 0 failed assets against your change.
- If your change touches navigation, run a manual pass across the routes it could affect — there is no automated cross-route navigation test beyond what `validate.js` covers.

## Style

- Vanilla HTML5, CSS3, and JavaScript only — no framework, no TypeScript, no build-time transform. Classic `<script>` tags, never ES Modules (the application must keep working from a plain `file://` URL).
- No new npm dependency, no CDN reference, no dependency beyond what's already vendored (Bootstrap, Bootstrap Icons). If a feature genuinely needs a third-party library, that's a discussion to have in an issue first, not a dependency to add silently in a PR.
- Match the existing header-comment convention: state the file's purpose, its architectural role, and any Release 2 extension point it deliberately leaves open, the way every existing platform/service/workspace file already does.

## Documentation

If your change affects something `AUDITOS.md` documents — a workspace's behavior, a platform file's responsibility, a known gap in Appendix C — update the corresponding section in the same pull request. Documentation drift between the canonical reference and the actual code is exactly the class of problem this project has an unusually low tolerance for (see Appendix C's own self-corrections, C.17–C.19).

## Submitting a Change

1. Open an issue describing the problem or feature before starting non-trivial work, so the approach can be discussed first.
2. Keep pull requests scoped to one concern — a bug fix doesn't need an accompanying refactor.
3. Write a commit message and PR description that explain *why*, not just *what* — the diff already shows what changed.
4. Reference the issue the PR resolves.

## Reporting Issues

Open a GitHub issue with: what you expected, what actually happened, the exact route/workspace involved, and console output from `node prototype/tools/validate.js` if the issue is reproducible through it. Screenshots are welcome and genuinely useful given how visual this platform is.
