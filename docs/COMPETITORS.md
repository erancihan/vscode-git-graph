# Competitor comparison: Git Graph Community 2.0.2 versus the field

Research date: 2026-10-15. Install counts come from the Visual Studio
Marketplace gallery API and the Open VSX API on that date. "Last update" is the
date of the latest Marketplace release unless stated otherwise. Feature claims
come from each project's Marketplace page, README, docs, or changelog. Where a
claim could not be verified, the matrix says `unknown`. The "Ours" column
describes version 2.0.2, which is the 1.4.6 feature set with a modern
toolchain. The upstream 1.30.0 column is derived from `docs/UPSTREAM_GAP.md`.

## 1. The competitors

### Git Graph 1.30.0 (`mhutchie.git-graph`)

The original. It is the extension this fork continues from, and it is still the
reference point for every other fork. Its last release was 1.30.0 on
2021-04-05; the repository saw a final push in July 2023 and is effectively
unmaintained. License: a modified MIT that forbids publishing or distributing
derivative works (since May 2019). Installs: about 15.5 million on the
Marketplace and 1.17 million downloads on Open VSX, rating 4.9 from 679
reviews. Strengths: a complete, carefully designed feature set (find widget,
stashes, rebase, push/pull/fetch, remotes widget, code review mode, issue
linking, per-repository settings, rebindable shortcuts, remote and web
support). Its weaknesses are the license, the dead issue tracker, and context
menu breakage on recent VS Code builds that the forks below exist to fix.

### GitLens (`eamodio.gitlens`)

GitKraken's all-in-one Git extension, version 2026.10.x, updated daily,
about 53.3 million Marketplace installs and 17.7 million Open VSX downloads.
License: MIT for the open-source parts, a separate proprietary license for the
`plus` directories. The Commit Graph is a table-style graph with a sticky
header, virtualized rows, drag-to-reorder columns, a minimap, search with
operators (`message:`, `author:`, `file:`, `change:`), filter presets (All /
Current / Smart branches), hide-branch and hide-tag actions, an uncommitted
row per worktree, and in-row actions for branch, merge, rebase, cherry-pick,
revert, stash, push, pull, squash, drop, reword. Tiering: GitLens states that
the Commit Graph, Worktrees, and Visual History are free on public and local
repositories and require Pro on private repositories; natural-language search,
in-graph Compare mode, Launchpad, the Pull Requests panel, agent features, and
all AI features are Pro. The Interactive Rebase Editor is free. The graph also
runs in VS Code for the Web (vscode.dev, github.dev). Strengths: scale,
polish, integrations, and the broadest feature set of any graph. Weaknesses:
a paid tier for private repositories, account prompts, and a very large
extension.

### GitLG, "git log --graph" (`phil294.git-log--graph`)

An MIT-licensed, independent graph that is explicitly positioned as the
license-clean alternative to Git Graph. Version 0.1.35, released 2026-04-17;
about 41.7 thousand Marketplace installs and 88 thousand Open VSX downloads,
rating 4.8. It loads up to 15,000 commits at once behind a virtual scroller,
has a sticky header, a branch-tips strip that follows the viewport, Ctrl+F
quick search that filters by message, author, email, file name, and file
content, drag-and-drop branch merging, multi-select, custom git log arguments,
and a fully user-defined action system (every button, its git arguments, its
prompts, and its placement are configuration). It shows stashes, insertion and
deletion stats, gravatar avatars, a blame line in the status bar, and supports
custom CSS. Strengths: configurability, performance, license. Weaknesses: no
interactive rebase editor, no worktrees, no per-repository settings, fewer
built-in dialogs; a single-maintainer project with a slower release cadence.

### Git Graph Plus (`the0807.git-graph-plus`)

A from-scratch rewrite (the README states no Git Graph code is used) under
Apache-2.0. Version 0.7.3, released 2026-06-30, first published 2026-03;
about 3.4 thousand Marketplace installs and 14.5 thousand Open VSX downloads,
rating 4.5. It is the broadest of the independent graphs: topological ordering,
color-coded rails with regex-to-color branch colors, three views (graph,
reflog, statistics), search by message, author, date range, hash, or changed
file, multi-commit combined changes, interactive rebase with drag-to-reorder,
drag-to-rebase and drag-to-merge, fixup and autosquash, amend, conflict
prediction with VS Code 3-way merge editor integration, a built-in diff viewer
with Shiki highlighting and image diff modes, patch export, stashes with
untracked and keep-index options, worktrees, bisect, Git Flow, LFS with file
locks, submodules, reflog with dangling-commit recovery, remote add/remove,
auto-fetch, signature status, Markdown commit messages, issue and PR
autolinks, push-status dots, and English, Korean, and Simplified Chinese UI.
Strengths: feature breadth and ambition. Weaknesses: young, small install
base, no per-repository settings, no context menu customization, no code
review mode.

### (neo) Git Graph (`asispts.neo-git-graph`)

The closest sibling to this project: an MIT fork from the same last MIT commit
(`4af8583`, 1.4.6). Version 0.6.0, released 2026-08-25, first published
2026-02; about 14 thousand Marketplace installs and 35 thousand Open VSX
downloads. It adds devcontainer and remote-container support, UI translations
(English, Simplified Chinese, Traditional Chinese), and a tooling cleanup; it
deprecated avatars in 0.6.0. All settings were renamed to the `neo-git-graph.*`
prefix, so users cannot carry over `git-graph.*` settings. Feature-wise it is
the 1.4.6 set, the same as ours. Strengths: license, i18n, container support,
a seven-month head start on the Marketplace. Weaknesses: no feature beyond
1.4.6 yet.

### Git Graph v3 / "Git Branch & Tag Graph" (`gxl.git-graph-3`) and Git Graph 2 (hansu)

`gxl.git-graph-3`, version 1.37.19, released 2026-07-16, first published
2025-02; about 70 thousand Marketplace installs and 7 thousand Open VSX
downloads, rating 3.9 from 27 reviews. It is a continuation of the upstream
1.30 code base that fixes the context menu bug on recent VS Code, adds a tag
filter dropdown, trims activation events, and allows double newlines in
commit messages. Its manifest says "SEE LICENSE IN LICENSE" and the linked
repository (`git-hub-tig/vscode-git-graph`) returned 404 on the research
date, so its license could not be verified; because it derives from
post-2019 upstream code it is presumably bound by upstream's no-derivatives
license.

hansu's Git Graph 2 (`github.com/hansu/vscode-git-graph`) is not on the
Marketplace; users install a `.vsix` from GitHub releases. Version 1.31.8,
2026-09-09, 306 stars. Its LICENSE is the upstream modified MIT with the
no-derivatives clause. On top of 1.30 it adds a rebase todo editor with drag
reorder, path-based commit filtering (dropdown and Explorer context menu),
a panel view location, multi-select with squash and drop, single-branch and
author filters, a sticky header option, a jump-to-HEAD button, toolbar
visibility settings, column resizing without the header menu, "Allow
unrelated histories", "No Verify" on push/merge, "Reset Last Commit", "Edit
Message" (amend), and "Pull Branch". It is the best picture of what a
maintained Git Graph lineage looks like, but it cannot be distributed on a
marketplace.

### GitCharm (`rionoir.gitcharm`)

A GPL-3.0 "whole Git workflow" extension, version 0.8.2, released 2026-10-14,
first published 2026-06; about 1 thousand Marketplace installs and 11 thousand
Open VSX downloads, rating 5.0 from 4 reviews. The Log panel has a commit
graph with a branch and tag sidebar, filters by text, author, branch, date,
and repository across the whole history, a live uncommitted-changes row,
per-repository colors, multi-commit selection across repositories, stashes in
the graph, and tag create/merge/push/delete. Around it sit a commit panel
with tree and flat views and AI commit messages, an IntelliJ-style interactive
rebase editor (pick, reword, edit, squash, fixup, drop with P/R/E/S/F/D keys),
shelve and stash, worktrees (create, open, lock, remove, prune), inline blame,
3-way or AI conflict resolution, protected branches, Git profiles, PR and
issue integration with GitHub, GitLab, Bitbucket Cloud, Gitea/Forgejo, and
Azure DevOps, and a seven-language UI. Strengths: an opinionated IDE-style
workflow and forge integration. Weaknesses: the graph is one panel of many,
GPL licensing, and a tiny install base so far.

### Interactive Git Log (`interactive-smartlog.interactive-smartlog`)

Proprietary but free (the README states no paid tier) and built on code from
Meta's Sapling ISL. Version 0.2.137, released 2026-09-23, first published
2024-02; about 14.8 thousand Marketplace installs, not on Open VSX, rating 5.0
from 10 reviews. It is a stack-centric smartlog rather than a full history
graph: it draws your commits from the point where they diverge from the
remote default branch, with a live uncommitted-changes section with
stage/unstage, one-click commit and amend, drag-to-reorder, squash and drop,
inline rebase conflict resolution, PR and CI status per branch via the GitHub
CLI, and an eleven-language UI. It collects telemetry (can be disabled).
Strengths: the best stacked-commit editing experience. Weaknesses: no full
history, no tags, stashes, cherry-pick, or worktrees, closed source.

### Speedy Git (`onlineeric.speedy-git-ext`)

An MIT "performance-first Git graph, action tool, and worktrees manager" for
VS Code and Cursor. Version 5.19.3, released 2026-10-15 (very frequent
releases), first published 2026-03; about 0.8 thousand Marketplace installs
but 50 thousand Open VSX downloads (Cursor users), rating 5.0 from 4 reviews.
It uses virtual scrolling with batch prefetch, color-coded lanes, avatars,
resizable columns, multi-term search over messages, hashes, authors, emails,
branches, and tags, filters by branch, author, and date, comparison of any two
refs with PR-style three-dot diffs, file tree or list details with per-file
stats and parent/child navigation, merge, rebase, cherry-pick, revert, reset,
amend, fixup, drop, push, pull, fetch, interactive rebase with drag-and-drop
and autosquash, stashes, worktree create/open/reveal/remove, on-demand GPG and
SSH signature verification, multiple graph tabs, submodule navigation, remote
management, and configurable autolinks (Jira, GitHub, GitLab). Strengths: speed
and worktree workflows aimed at parallel AI-agent sessions. Weaknesses: tiny
community, no i18n, no per-repository settings, no code review mode.

### Git History (`donjayamanne.githistory`)

The old standard, MIT, version 0.6.20 from 2023-03-05 with a last repository
push in 2024-08; about 17.4 million Marketplace installs and 660 thousand Open
VSX downloads, rating 4.4. It shows a paged log with a simple graph, filters by
branch and author, a search box, file and line history, GitHub avatars,
compare branches or commits, cherry-pick, create branch and tag, soft and hard
reset, revert, merge, and rebase. Strengths: install base and file/line
history. Weaknesses: unmaintained, no stashes, remotes, push/pull, or
interactive editing, and a dated UI.

### VS Code built-in Source Control Graph (since VS Code 1.93)

Shipped by Microsoft in the Source Control view since August 2024, free and
MIT. It draws commits with branch colors, incoming and outgoing commits for the
upstream, a reference picker (Auto, or any set of local branches, remote
branches, and tags), a repository picker, paging with `scm.graph.pageSize` and
`scm.graph.pageOnScroll`, badges, and context actions: open changes (multi
diff), compare with a reference, remote, or merge base, cherry-pick, checkout
(detached), create branch or tag, checkout branch or tag, delete branch,
delete tag, plus pull and push in the title bar. With the built-in GitHub
extension it adds avatars, "Open on GitHub", and clickable issue and PR
references in hovers. Strengths: zero install, localized, works in every remote
setup. Weaknesses: no stashes, no merge, rebase, revert, reset, or remotes,
no search beyond the tree filter, no file tree, and no customization beyond
hiding title actions.

## 2. Feature matrix

Marks: `yes`, `no`, `partial`, `Pro-only`, `unknown`. For GitLens, `yes`
means available in the Community tier on public and local repositories; the
whole Commit Graph needs Pro on private repositories, and cells marked
`Pro-only` need Pro everywhere.

Column key: GG 1.30 = upstream Git Graph 1.30.0; GitLens = GitLens Commit
Graph; GitLG = phil294 GitLG; GG+ = Git Graph Plus; neo = (neo) Git Graph;
gxl = Git Graph v3; hansu = hansu Git Graph 2; GitCharm; IGL = Interactive
Git Log; Speedy = Speedy Git; GitHist = Git History; VS Code = built-in Source
Control Graph; Ours = Git Graph Community 2.0.2.

### Graph rendering

| Feature | GG 1.30 | GitLens | GitLG | GG+ | neo | gxl | hansu | GitCharm | IGL | Speedy | GitHist | VS Code | Ours |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Configurable branch colors | yes | yes | yes | yes | yes | yes | yes | partial | no | yes | no | yes | yes |
| Graph line style (rounded/angular) | yes | no | partial | unknown | yes | yes | yes | unknown | no | unknown | no | no | yes |
| Column toggle / reorder / resize | yes | yes | unknown | unknown | partial | yes | yes | unknown | no | partial | no | no | partial |
| Sticky header | no | yes | yes | unknown | no | no | yes | unknown | no | unknown | unknown | no | no |
| Large repository performance (virtual scroll or explicit tuning) | partial | yes | yes | partial | partial | partial | partial | unknown | partial | yes | partial | partial | partial |
| Load more commits | yes | yes | partial | yes | yes | yes | yes | unknown | no | yes | yes | yes | yes |
| Auto-load on scroll | yes | yes | partial | unknown | no | yes | yes | unknown | no | yes | no | yes | no |
| Commit ordering (date / author date / topo) | yes | yes | partial | yes | no | yes | yes | unknown | no | unknown | no | no | no |
| Stashes drawn on the graph | yes | yes | yes | yes | no | yes | yes | yes | no | yes | no | no | no |
| Mute merge / non-ancestor commits | yes | partial | no | unknown | no | yes | yes | no | no | unknown | no | no | no |

### Filters and search

| Feature | GG 1.30 | GitLens | GitLG | GG+ | neo | gxl | hansu | GitCharm | IGL | Speedy | GitHist | VS Code | Ours |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Branch filter (single) | yes | yes | partial | yes | yes | yes | yes | yes | partial | yes | yes | yes | yes |
| Multi-branch selection | yes | partial | unknown | unknown | no | yes | yes | unknown | no | unknown | no | yes | no |
| Find widget (in-graph find) | yes | yes | yes | yes | no | yes | yes | yes | no | yes | yes | partial | no |
| Author filter | partial | yes | yes | partial | no | partial | yes | yes | no | yes | yes | no | no |
| Text search (message / hash) | partial | yes | yes | yes | no | partial | partial | yes | no | yes | yes | partial | no |
| File path or content search | no | yes | yes | yes | no | no | partial | unknown | no | unknown | partial | no | no |
| Exclude or hide patterns (globs, hide refs, tag filter) | partial | yes | partial | unknown | no | yes | yes | unknown | no | partial | no | partial | no |

### Commit details

| Feature | GG 1.30 | GitLens | GitLG | GG+ | neo | gxl | hansu | GitCharm | IGL | Speedy | GitHist | VS Code | Ours |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| File tree | yes | yes | unknown | yes | yes | yes | yes | partial | no | yes | no | no | yes |
| File list | yes | yes | unknown | unknown | no | yes | yes | partial | partial | yes | yes | yes | no |
| Open VS Code diff from a file | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Multi-select / compare two commits | yes | yes | partial | yes | no | yes | yes | yes | no | yes | yes | partial | no |
| Tags shown on the graph | yes | yes | yes | yes | yes | yes | yes | yes | no | yes | yes | yes | yes |
| Signature status | yes | unknown | unknown | yes | no | yes | yes | no | no | yes | no | no | no |
| Markdown / links / emoji in messages | yes | partial | no | yes | no | yes | yes | unknown | no | partial | no | partial | no |

### Git actions

| Feature | GG 1.30 | GitLens | GitLG | GG+ | neo | gxl | hansu | GitCharm | IGL | Speedy | GitHist | VS Code | Ours |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Branch create / checkout | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | partial | yes | yes |
| Branch rename | yes | yes | yes | yes | yes | yes | yes | yes | unknown | unknown | no | no | yes |
| Branch delete (local and remote) | yes | yes | yes | yes | partial | yes | yes | yes | yes | yes | no | partial | partial |
| Merge | yes | yes | yes | yes | yes | yes | yes | yes | unknown | yes | yes | no | yes |
| Rebase (non-interactive) | yes | yes | yes | yes | no | yes | yes | yes | yes | yes | yes | no | no |
| Cherry pick | yes | yes | yes | yes | yes | yes | yes | partial | no | yes | yes | yes | yes |
| Revert | yes | yes | yes | yes | yes | yes | yes | unknown | partial | yes | yes | no | yes |
| Reset | yes | yes | partial | yes | yes | yes | yes | unknown | unknown | yes | yes | no | yes |
| Tag add / delete | yes | yes | partial | yes | yes | yes | yes | yes | no | partial | partial | yes | yes |
| Tag push | yes | unknown | partial | yes | yes | yes | yes | yes | no | partial | no | no | yes |
| Push / pull / fetch | yes | yes | partial | yes | no | yes | yes | yes | partial | yes | no | yes | no |
| Stash list / apply / pop / drop | yes | yes | yes | yes | no | yes | yes | yes | no | yes | no | no | no |
| Worktrees | no | yes | no | yes | no | no | no | yes | no | yes | no | no | no |
| Interactive rebase editor | partial | yes | no | yes | no | partial | yes | yes | yes | yes | no | no | no |
| Fixup / autosquash | no | partial | no | yes | no | no | partial | partial | partial | yes | no | no | no |
| Bisect | no | unknown | no | yes | no | no | no | no | no | no | no | no | no |
| Amend / edit message from the graph | no | yes | no | yes | no | no | yes | unknown | yes | yes | no | no | no |
| Drop a commit | yes | yes | no | yes | no | yes | yes | yes | yes | yes | no | no | no |
| Archive (zip/tar) from a ref | yes | no | no | no | no | yes | yes | no | no | no | no | no | no |

### Uncommitted changes, remotes, repositories

| Feature | GG 1.30 | GitLens | GitLG | GG+ | neo | gxl | hansu | GitCharm | IGL | Speedy | GitHist | VS Code | Ours |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Uncommitted changes row (clickable, with actions) | yes | yes | unknown | yes | partial | yes | yes | yes | yes | unknown | no | unknown | partial |
| Stage / unstage / commit from the view | no | partial | no | unknown | no | no | no | yes | yes | unknown | no | no | no |
| Remotes management (add / edit / delete / fetch one) | yes | yes | unknown | yes | no | yes | yes | unknown | unknown | yes | no | no | no |
| Multi-repository workspace | yes | yes | partial | yes | yes | yes | yes | yes | no | yes | partial | yes | yes |
| Submodules | yes | unknown | unknown | yes | no | yes | yes | yes | unknown | yes | unknown | partial | no |
| Subfolder repository discovery | yes | yes | partial | unknown | yes | yes | yes | yes | no | unknown | unknown | yes | yes |
| Repository switching in the view | yes | yes | yes | yes | yes | yes | yes | yes | no | yes | partial | yes | yes |

### Everything else

| Feature | GG 1.30 | GitLens | GitLG | GG+ | neo | gxl | hansu | GitCharm | IGL | Speedy | GitHist | VS Code | Ours |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Avatars | yes | yes | yes | yes | partial | yes | yes | yes | no | yes | yes | partial | yes |
| Issue linking / autolinks | yes | yes | unknown | yes | no | yes | yes | yes | unknown | yes | no | partial | no |
| Pull request creation or integration | yes | yes | no | partial | no | yes | yes | yes | yes | no | no | partial | no |
| Keyboard shortcuts in the graph | yes | yes | partial | yes | partial | yes | yes | partial | unknown | partial | partial | yes | partial |
| Settings per repository | yes | partial | no | no | no | yes | yes | no | no | no | no | no | no |
| Context menu / action customization | yes | yes | yes | no | no | yes | yes | no | no | partial | no | partial | no |
| Code review mode (track reviewed files) | yes | no | no | no | no | yes | yes | partial | no | no | no | no | no |
| Multi-language UI | no | unknown | no | yes | yes | no | no | yes | yes | unknown | no | yes | no |
| Remote development (SSH, containers, WSL) | yes | yes | unknown | unknown | yes | yes | yes | unknown | unknown | unknown | unknown | yes | partial |
| VS Code for the Web (vscode.dev) | yes | yes | unknown | no | no | yes | yes | no | no | no | no | unknown | no |
| Theming (theme colors, high contrast) | yes | yes | yes | yes | partial | yes | yes | unknown | unknown | yes | unknown | yes | partial |
| Conflict prediction or resolution help | no | Pro-only | no | yes | no | no | no | yes | yes | unknown | no | no | no |
| AI features | no | Pro-only | no | no | no | no | no | yes | no | no | no | no | no |
| Open source license that allows redistribution | no | partial | yes | yes | yes | unknown | no | yes | no | yes | yes | yes | yes |

Notes on the "Ours" column:

- "Column toggle / reorder / resize" is `partial` because column widths can be
  dragged and are stored per repository, but columns cannot be hidden.
- "Branch delete" is `partial` because only local branches can be deleted.
- "Uncommitted changes row" is `partial` because the row is drawn but has no
  click or context actions.
- "Keyboard shortcuts" is `partial` because only Escape closes dialogs and
  menus.
- "Remote development" is `partial` because `extensionKind` is `workspace`,
  which puts the extension on the remote side, but this has not been tested
  end to end in this fork.
- "Theming" is `partial` because the webview follows the active theme colors
  but has no high-contrast handling and dialogs use native inputs.

## 3. Gaps versus the field

Each row lists a feature we lack that at least two competitors have. The count
is the number of competitors marked `yes` in the matrix (`partial` in
parentheses). "In 1.30" means upstream had it, so the item is already planned
in `docs/UPSTREAM_GAP.md`; the theme number refers to that document's roadmap.
"New" means it goes beyond upstream and needs its own design.

| Rank | Feature we lack | Competitors with it | Marketing prominence | Status |
|---|---|---|---|---|
| 1 | Rebase from the graph | 10 | High: every graph lists it | In 1.30 (theme 5) |
| 2 | Find widget / search | 9 (+1) | High: headline feature for GitLens, GitLG, GG+, Speedy | In 1.30 (theme 9) |
| 3 | Push / pull / fetch from the view | 9 (+2) | High | In 1.30 (theme 5) |
| 4 | Stashes on the graph with apply / pop / drop | 8 | High | In 1.30 (theme 7) |
| 5 | Compare two commits / multi-select | 8 (+2) | High: GitLens, GG+, GitCharm, Speedy all show it | In 1.30 (theme 6) |
| 6 | Interactive uncommitted changes row | 7 (+1) | Medium-high; GitLens, GitCharm, IGL make it central | In 1.30 (theme 5) |
| 7 | Author filter | 7 (+2) | Medium | New (upstream only searched author text in the find widget); hansu adds it to the Git Graph layout |
| 8 | Issue linking / autolinks | 7 (+1) | Medium | In 1.30 (theme 14) |
| 9 | Interactive rebase editor (reorder, squash, fixup, reword, drop) | 6 (+2) | High: GitLens, GG+, GitCharm, IGL, Speedy market it | New (upstream only launched `git rebase -i` in a terminal) |
| 10 | Remotes management | 6 | Medium | In 1.30 (theme 11) |
| 11 | Auto-load more commits on scroll | 6 (+1) | Medium | In 1.30 (theme 3) |
| 12 | Keyboard navigation and shortcuts | 6 (+4) | Medium | In 1.30 (theme 12) |
| 13 | Submodule registration and switching | 6 (+1) | Medium | In 1.30 (theme 10) |
| 14 | Drop a commit | 7 | Low-medium | In 1.30 (theme 5) |
| 15 | Pull request creation or links | 6 (+2) | Medium; central for GitLens, GitCharm, IGL | In 1.30 (theme 14) |
| 16 | Commit ordering (date / author date / topo) | 5 (+1) | Low-medium; GG+ markets topological order | In 1.30 (theme 3) |
| 17 | Column visibility toggle | 5 | Low | In 1.30 (theme 8) |
| 18 | File list view in details | 5 (+2) | Low | In 1.30 (theme 6) |
| 19 | Signature status | 5 | Low-medium; Speedy markets GPG/SSH verification | In 1.30 (theme 6) |
| 20 | Amend / edit the last commit message from the graph | 5 | Medium | New |
| 21 | Multi-language UI | 5 | Medium; the neo fork's main differentiator | New |
| 22 | Multi-branch selection in the branch dropdown | 4 (+1) | Low | In 1.30 (theme 8) |
| 23 | Worktrees (list, create, open, remove) | 4 | High in 2026 marketing (GitLens, GG+, GitCharm, Speedy tie it to parallel agent sessions) | New |
| 24 | Markdown, links, and emoji in commit messages | 4 (+3) | Low | In 1.30 (theme 6) |
| 25 | File path filter for the graph | 4 (+2) | Medium; hansu, GitLens, GitLG, GG+ | New |
| 26 | Conflict prediction and resolution help | 3 (+1 Pro) | Medium; GG+ and GitCharm headline it | New |
| 27 | Context menu / action customization | 5 (+2) | Low | In 1.30 (theme 4) |
| 28 | VS Code for the Web | 4 | Low | In 1.30 (theme 19) |
| 29 | Code review mode | 3 (+1) | Low | In 1.30 (theme 13) |
| 30 | Settings per repository | 3 (+1) | Low | In 1.30 (themes 4 and 11) |
| 31 | Sticky header | 3 | Low-medium; GitLG lists it as a reason not to use Git Graph | New (hansu adds it to the Git Graph layout) |
| 32 | Fixup / autosquash | 2 (+3) | Medium with interactive rebase | New |
| 33 | Mute merge commits / non-ancestors of HEAD | 3 (+1) | Low | In 1.30 (theme 8) |
| 34 | Archive a ref as zip/tar | 3 | Low | In 1.30 (theme 5) |
| 35 | Stage / unstage / commit from the view | 2 (+2) | Medium for GitCharm and IGL | New; out of scope for a graph-first extension unless we decide otherwise |
| 36 | Drag-and-drop merge / rebase | 2 | Medium for GitLG and GG+ | New |

Reading of the table: the first eighteen gaps are all upstream 1.30 features,
which confirms that the roadmap in `docs/UPSTREAM_GAP.md` is the right order of
work. The new items that the field has moved to since 2021 are, in order of
how many competitors ship them: author filter, interactive rebase editor,
amend from the graph, multi-language UI, worktrees, path filter, conflict
help, sticky header, fixup/autosquash, and drag-and-drop merge or rebase.

## 4. Distinctive opportunities

Features that no or few competitors do well, one line each.

- Drop-in replacement for `mhutchie.git-graph`: identical `git-graph.*`
  setting and command names under an MIT license. No other fork offers this;
  neo renamed its prefix, gxl and hansu are not redistributable.
- A Marketplace-published, license-clean continuation of the Git Graph UI:
  gxl has 70 thousand installs with an unverifiable license, hansu is `.vsix`
  only; a trustworthy option with the same look is an open slot.
- Per-repository settings and exportable repository settings (`.vscode`
  file for teams): only the Git Graph lineage has it, and nobody markets it.
- Code review mode (reviewed-file tracking that survives restarts): only the
  Git Graph lineage; GitLens and GitCharm review pull requests instead.
- Bisect from the graph: only Git Graph Plus has a UI for it.
- Tag signature verification in tag details: only upstream's 1.31 beta.
- Reflog and first-parent views, dangling commit recovery: Git Graph Plus is
  the only one with a reflog view; upstream had reflog and first-parent as
  per-repository options.
- Sticky header plus virtualized rows in a table layout: GitLens and GitLG
  do it; no Git Graph-style fork on the Marketplace does.
- Context menu action visibility and user-defined actions: GitLG's custom
  action system is the only one more flexible than upstream's visibility
  map; combining both would be unique.
- Worktree-aware uncommitted rows (one row per worktree): only GitLens.
- Accessibility: upstream's letter indicators and high-contrast support have
  no equivalent in the newer graphs.
- Privacy: no account, no telemetry, no AI calls. IGL collects telemetry,
  GitLens and GitCharm add accounts or AI; a plain statement of this is a
  differentiator for corporate users.
- Small footprint: a single webview with no bundled language servers or
  forge SDKs, which matters for Remote Development and slow hosts.

## 5. Sources

- Visual Studio Marketplace gallery API (`extensionquery`, flags 914) for
  install counts, versions, publish and update dates, queried 2026-10-15.
- Open VSX API, `https://open-vsx.org/api/<publisher>/<name>`, queried
  2026-10-15.
- GitHub REST API, `https://api.github.com/repos/<owner>/<repo>`, queried
  2026-10-15 for license, default branch, stars, and last push.
- https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph
- https://github.com/mhutchie/vscode-git-graph and local `docs/UPSTREAM_GAP.md`
- https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens
- https://github.com/gitkraken/vscode-gitlens/blob/main/README.md
- https://help.gitkraken.com/gitlens/gitlens-features/
- https://help.gitkraken.com/gitlens/gitlens-home/
- https://help.gitkraken.com/gitlens/gitlens-community-vs-gitlens-pro/
- https://gitkraken.com/gitlens/pricing
- https://gitkraken.com/press/gitlens-12-vs-code-for-the-web-support
- https://marketplace.visualstudio.com/items?itemName=phil294.git-log--graph
- https://github.com/phil294/GitLG/blob/master/README.md
- https://marketplace.visualstudio.com/items?itemName=the0807.git-graph-plus
- https://github.com/the0807/git-graph-plus/blob/main/README.md
- https://marketplace.visualstudio.com/items?itemName=asispts.neo-git-graph
- https://github.com/asispts/neo-git-graph/blob/main/README.md
- https://marketplace.visualstudio.com/items?itemName=gxl.git-graph-3
- https://github.com/git-hub-tig/vscode-git-graph (returned 404 on 2026-10-15)
- https://github.com/hansu/vscode-git-graph (README, CHANGELOG, LICENSE)
- https://marketplace.visualstudio.com/items?itemName=rionoir.gitcharm
- https://github.com/RioNoir/GitCharm/blob/main/README.md
- https://marketplace.visualstudio.com/items?itemName=interactive-smartlog.interactive-smartlog
- https://www.interactive-git-log.com/
- https://marketplace.visualstudio.com/items?itemName=onlineeric.speedy-git-ext
- https://github.com/onlineeric/speedy-git-ext/blob/main/README.md
- https://marketplace.visualstudio.com/items?itemName=donjayamanne.githistory
- https://github.com/DonJayamanne/gitHistoryVSCode/blob/main/README.md
- https://code.visualstudio.com/docs/sourcecontrol/history
- https://code.visualstudio.com/updates/v1_93
- https://code.visualstudio.com/updates/v1_94
- https://code.visualstudio.com/updates/v1_96
- https://code.visualstudio.com/updates/v1_97
