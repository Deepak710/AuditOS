# Right Context Panel Component

Reusable structural context panel for the AuditOS Application Shell.

Mounted inside the shell's panel region — the semantic
`<aside class="aos-panel" aria-label="Context panel">` landmark in
`prototype/index.html`. Styled by `prototype/css/panel.css` using the
Design Token Foundation (`prototype/css/variables.css`).

## Scope

This is a **foundation**: structure only. Five empty regions that later issues
populate. It contains no supporting information, relationships, timeline,
activity feed, AI insights, routing, business logic, or JavaScript.

## Regions

| Region | Class | Reserved for |
|--------|-------|--------------|
| Panel header | `.aos-context-panel__header` | Panel title / close and collapse controls |
| Primary content | `.aos-context-panel__primary` | Primary contextual information for the active workspace |
| Secondary content | `.aos-context-panel__secondary` | Supporting contextual information |
| Footer | `.aos-context-panel__footer` | Persistent panel footer / status area |
| Collapse placeholder | `.aos-context-panel__collapse` | Future collapse / expand control |

The regions stack as a vertical column. `.aos-context-panel__primary` grows to
consume free space and scrolls independently; the other regions keep their
intrinsic height. A collapsed structural state pairs with the shell-level
`.aos-shell--panel-collapsed` class defined in `prototype/css/layout.css`;
because the panel's collapsed width is zero, that state hides the component
entirely rather than narrowing it to an icon rail.

## Usage

No component loader or build step exists in the prototype yet, so the markup in
`context-panel.html` is embedded directly inside the shell's panel region in
`index.html`. `context-panel.html` is the canonical source for that markup; keep
the two in sync until a loader exists.
