# Roadmap

Git Graph Community is an MIT fork of Git Graph, continued from version 1.4.6. The goal is a maintained extension that matches the original Git Graph 1.30 feature for feature, then matches what the wider field offers today, while staying a drop-in replacement with the same `git-graph.*` settings and commands.

Supporting documents:

- `docs/UPSTREAM_GAP.md`: every feature upstream added after our fork point, release by release, with the re-implementation order.
- `docs/COMPETITORS.md`: feature matrix against GitLens, GitLG, Git Graph Plus, (neo) Git Graph, Git Graph v3 and 2, GitCharm, Interactive Git Log, Speedy Git, Git History and the built-in Source Control Graph.
- `docs/UPSTREAM_PRS.md`: triage of the open upstream pull requests.

Work is tracked in GitHub milestones. Each theme has a tracking issue labeled `theme`. Pull requests reference the tracking issue.

## Rules

1. No code is copied from upstream commits after `4af8583`, nor from any other Git graph extension. Features are re-implemented from their description. Every pull request confirms this in its checklist.
2. Settings and commands keep the `git-graph.*` names. Users switch from the original extension without changing their configuration.
3. No account, no telemetry, no network calls except the ones the user enables (avatars, issue links).
4. Each milestone ships as a Marketplace and Open VSX release. Small releases are preferred over large ones.

## Where we stand (2.6.0)

Shipped in 2.0.x: the Git Graph 1.4.6 feature set, a current toolchain (TypeScript 5, ESLint, Node 20, VS Code 1.74 or later), CI, release pipeline, two bug fixes.

Shipped in 2.1.0 (milestone "Foundations"): Output Channel logging; `spawn`-based git invocation with argument guards; git executable discovery; Jest tests in CI; `asWebviewUri` and a nonce-only script policy; grouped setting names with deprecated fallbacks; commit ordering, auto-load on scroll, tag and remote visibility, mailmap, untracked files, dialog defaults and context menu visibility settings; graph rendering linear in rows.

Shipped in 2.2.0 (milestone "Core actions", first release): fetch, push, pull, delete remote branch, fetch into local branch, rebase; create branch with checkout, squash and no-commit merges, cherry pick options, drop commit, reset and clean uncommitted changes, signed commits and tags; stashes on the graph with apply, pop, drop, branch and stash actions; find widget; column visibility, muted commits, first-parent and reflog loading, scroll shortcuts; file actions, file list view, compact folders and commit comparison in the details view; repository add and remove commands, submodules, dropdown order, Source Control view button; multi-select branches and custom glob patterns; HEAD entry, branches and tags in the details, short hash copying.

Shipped in 2.2.1 (milestone "Core actions", second release): interactive rebase in the integrated terminal; reference label alignment, combined local and remote branch labels and label tooltips; docked and resizable details view with clickable parents and arrow-key navigation; commit signature status; archive; external diff tool; push to several remotes. Milestone 2.2 is complete.

Shipped in 2.3.0 (milestone "Integrations"): Repository Settings widget (custom name, per-repository overrides, remotes with add / edit / delete / fetch / prune / hide, user details, issue linking); pull request creation for GitHub, GitLab, Bitbucket and custom providers; code review mode with an end-all command; avatar polish (SSH remotes, high DPI, Gravatar normalisation, no bundled token); utility commands (fetch, version information, open file); accessibility and theming (change type letters, theme colours, high contrast, focus outlines); askpass helper for credential prompts.

Shipped in 2.4.0 (milestone "Beyond upstream", first release): sticky header; reword and amend the checked-out commit; author and path filters; bisect from the graph; drag-and-drop merge, rebase and cherry pick.

Shipped in 2.4.1: worktrees (list, add, open, remove, prune) and conflict help (operation bar with Continue / Skip / Abort).

Shipped in 2.4.2: interactive rebase editor (#30) with the "Fixup into Parent" shortcut; localisation with a Turkish sample (#32); CI status dot for GitHub and GitLab (#39); conflict prediction in the merge, rebase and cherry pick dialogs (#35); one uncommitted-changes row per worktree (#33); translation of the commit details view.

Milestone 2.4 is complete with 2.4.2. Release 2.4.3 completes the Repository Settings widget (branches shown on load, export and import of `.vscode/git-graph.json`, git config includes). Release 2.5.0 adds the remaining parity settings and commands from the audit of `docs/UPSTREAM_GAP.md`: dialog defaults (push tag on add, fetch-remote pruning, squash pull message, on-load branches), file encoding, editor group for diffs, open circle position, inline Markdown, code review commands, and menus that survive a refresh. Release 2.6.0 adds emoji shortcodes, the latest tag hint, branch name checks, the HEAD flash and tooltip, and both dates with the committer email in the details. Open: Remote Development and network drive verification (need a reproduction), narrow layouts, SVN remotes, and the layout performance item.

Still missing versus Git Graph 1.30: export and import of repository settings, `git config` includes, initial branches per repository, pull request configuration stored per repository, and the smaller presentation items listed in `docs/UPSTREAM_GAP.md`. Missing versus the field: see the ranked table in `docs/COMPETITORS.md`, section 3 (milestone 2.4).

## Milestone 2.1: Foundations

Everything later depends on these. Target: a code base that the next three milestones can build on without rework.

| Theme | Tracking issue | Contents |
|---|---|---|
| Modernization, build and test infrastructure | #25 | Jest unit tests, webview CSP and `asWebviewUri`, `spawn`-based git calls, git executable detection like the built-in Git extension, `git.path` as an array, Remote Development, symlinks and network drives |
| Logging | #9 | Output Channel with git invocations, extension events and external tool errors |
| Data loading, refresh and graph rendering core | #26 | Graph construction and layout rewrite, thousands of branches and tags, stdout race fix, auto-load on scroll, commit ordering, detached HEAD, event delegation, refresh that keeps menus and dialogs open |
| Settings infrastructure | #10 | Grouped setting names with deprecated fallbacks, per-repository overrides, context menu visibility, dialog defaults, rebindable shortcuts |

Performance work from `docs/UPSTREAM_GAP.md`, "Phase 1.5", lands here: spawn-based git invocation, the graph core rewrite, event delegation and auto-load, opt-in load-time settings.

## Milestone 2.2: Core actions

Parity with the day-to-day use of Git Graph 1.30. Target: a user of the original extension finds every action they use.

| Theme | Tracking issue | Contents |
|---|---|---|
| Git actions and dialogs | #11 | Dialog framework, rebase, fetch, pull, push with force-with-lease and multiple remotes, squash merge, delete remote branch, cherry pick options, drop commit, signed commits and tags, archive, uncommitted changes actions |
| Commit Details View and file views | #12 | Compare two commits, dock and resize, file list view, compact folders, per-file actions, rich message rendering, clickable parents, signature status, external diff tool |
| Stash support | #13 | Stashes on the graph, apply, pop, drop, create with options |
| Graph view presentation and filtering | #14 | Column visibility, label alignment, muting, tooltips, branch dropdown multi-select and globs, hide remotes, reflogs, first-parent, scroll to HEAD |
| Find widget | #15 | Case and regex modes, step through matches, open details while stepping |
| Repository management | #16 | Add and remove repositories, submodules, follow the active editor, SCM title button, custom names, open terminal |
| Keyboard shortcuts | #17 | Rebindable layer, then shortcuts for dialogs, find, scroll and details navigation |

Quick wins from the upstream pull request triage land in this milestone: copy short hash (#602), SCM view button (#907), tags in commit details (#933), show HEAD button (#763), exclude branch glob patterns (#939), HEAD entry in the branch dropdown (#919).

## Milestone 2.3: Integrations

Parity with the rest of Git Graph 1.30.

| Theme | Tracking issue | Contents |
|---|---|---|
| Repository Settings widget | #18 | Remotes CRUD, fetch and prune, per-repository toggles, initial branches, user details, export and import |
| Code review mode | #19 | Reviewed-file tracking that survives restarts |
| Issue linking and pull request creation | #20 | Configurable issue patterns, issue from branch name, pull request providers |
| Avatars polish | #21 | SSH remotes, high DPI, Gravatar case handling |
| Askpass and credentials | #22 | HTTPS fetch and push without a credential helper, with its own security review |
| Accessibility and theming | #23 | Letter indicators, high contrast, selection color, themed controls |
| Utility commands | #24 | Version information, fetch command, open file from the diff title |

## Milestone 2.4: Beyond upstream

Features the field has adopted since 2021, in order of how many competitors ship them. Each gets a design note before implementation.

| Feature | Competitors with it | Notes |
|---|---|---|
| Author filter (#29) | 7 | Filter the graph by author, with the branch filter |
| Interactive rebase editor (#30) | 6 | Reorder, squash, fixup, reword, drop in a webview, with autosquash |
| Amend or reword the last commit from the graph (#31) | 5 | On the uncommitted changes row |
| Multi-language UI (#32) | 5 | `vscode.l10n` with community translations; upstream PR #580 (zh-cn) as a first contribution request |
| Worktrees (#33) | 4 | List, create, open, remove; one uncommitted row per worktree |
| File path filter (#34) | 4 | Show only commits that touch a path |
| Conflict help (#35) | 3 | Predict conflicts before merge or rebase, link to the merge editor |
| Sticky header (#36) | 3 | Keep the toolbar and column headers visible while scrolling; upstream PR #394 |
| Drag-and-drop merge or rebase (#37) | 2 | Drag a branch label onto another |
| Bisect from the graph (#38) | 1 | Only Git Graph Plus has it |
| Signature status column | 1 | Upstream PR #910 |
| CI status column (#39) | 1 | Upstream PR #473, ask the author to resubmit under MIT |

Out of scope unless demand appears: staging and committing from the view (the built-in Source Control view does this), AI features, accounts.

## Distinctive positions to keep

- The only MIT extension that is a drop-in replacement for `mhutchie.git-graph`.
- Per-repository settings with export for teams, and code review mode. Only the Git Graph lineage has them.
- Accessibility letter indicators and high contrast support.
- Small footprint: one webview, no bundled language servers or forge SDKs. Works well under Remote Development.
- Privacy: no account, no telemetry, no AI.

## Release cadence

- A release at the end of each milestone, and a patch release for any bug fix that a user reports.
- Versions follow `2.<milestone>.<patch>`. Pre-releases use `-beta.N` tags and are published only as GitHub releases.

## How to help

Pick a tracking issue, comment on which sub-task you take, and open a pull request against `master`. Read `CONTRIBUTING.md` for the license rule and the development setup.
