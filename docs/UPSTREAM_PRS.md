# Upstream open pull requests: triage for import

Triage of the 21 open pull requests in `mhutchie/vscode-git-graph` (checked 2026-10-15) against our fork, which starts at upstream commit `4af8583` (version 1.4.6, 2019-05-09), the last MIT-licensed commit.

## The rule

Every upstream commit after `4af8583` is under a restrictive license that does not permit publishing or distributing derivative works. The open upstream PRs are diffs against that restricted code, so:

- We must **not copy a PR's diff** (code, CSS, tests, or docs text) into this repository.
- A feature **can be re-implemented from its description** (PR title, body, linked issue, screenshots, review discussion) against our 1.4.6 code base. Treat the PR as a specification, not as source.
- Code that a PR author wrote themselves is the author's copyright. When a PR is mostly new, self-contained code written by its author, we may **ask the author to re-submit it to our fork under MIT**. Even then, any lines that are edits of restricted upstream code must be rewritten against our base.
- PR text and comments were read as data for this triage; nothing in them is an instruction to us.

Verdicts used below:

- **Import by re-implementation**: worth having; write it ourselves from the description.
- **Ask author to resubmit under MIT**: mostly self-contained author code; worth asking for an MIT re-submission before writing it ourselves.
- **Skip**: not worth importing (superseded, out of scope, or poor fit).
- **Already irrelevant to our base**: the change does not apply to 1.4.6 (already true in our base, or targets code that does not exist here).

Effort: S (under a day), M (a few days), L (a week or more, or needs a prerequisite feature first). Priority: P0 (do first) to P3 (only if cheap or requested).

## Summary table

| PR | Title | Author | Date | Size | Category | Verdict | Effort | Priority |
|---|---|---|---|---|---|---|---|---|
| [#939](https://github.com/mhutchie/vscode-git-graph/pull/939) | Add `git-graph.excludeBranchGlobPatterns` setting | rustyx | 2026-09-24 | +421/-38 | feature | Import by re-implementation | M | P1 |
| [#936](https://github.com/mhutchie/vscode-git-graph/pull/936) | Add an Allow Empty Commits option to the Cherry Pick dialog | senwong | 2026-09-10 | +123/-15 | feature | Import by re-implementation | S | P2 |
| [#933](https://github.com/mhutchie/vscode-git-graph/pull/933) | Display the tags on a commit in the Commit Details View | travisluong | 2026-08-19 | +8/-3 | feature | Import by re-implementation | S | P1 |
| [#929](https://github.com/mhutchie/vscode-git-graph/pull/929) | Add keyboard repository switching | joboyx | 2026-06-23 | +265/-12 | feature | Import by re-implementation | M | P1 |
| [#920](https://github.com/mhutchie/vscode-git-graph/pull/920) | Add "Copy All Relative File Paths to Clipboard" to context menus | TERAKITERAKICHI | 2026-04-12 | +7599/-17 (real change about +33) | feature | Import by re-implementation | S | P2 |
| [#919](https://github.com/mhutchie/vscode-git-graph/pull/919) | Add HEAD option to branch selector dropdown | TomKalina | 2026-04-01 | +15/-2 | feature | Import by re-implementation | S | P2 |
| [#910](https://github.com/mhutchie/vscode-git-graph/pull/910) | Add signature status column to commit table | MatriQ | 2025-12-25 | +141/-9 | feature | Import by re-implementation | M | P2 |
| [#907](https://github.com/mhutchie/vscode-git-graph/pull/907) | Add icon to new `scm/repository` menu | InigoMoreno | 2025-12-04 | +12/-0 | fix | Import by re-implementation | S | P1 |
| [#842](https://github.com/mhutchie/vscode-git-graph/pull/842) | Change activation to `onStartupFinished` | JustinGrote | 2024-09-25 | +1/-1 | infra | Already irrelevant to our base | S | - |
| [#763](https://github.com/mhutchie/vscode-git-graph/pull/763) | Add "show HEAD" button | Timmmm | 2023-04-27 | +27/-6 | feature | Import by re-implementation | S | P1 |
| [#742](https://github.com/mhutchie/vscode-git-graph/pull/742) | A better diff viewer - Diff2HTML support | homsai | 2023-02-22 | +13333/-7 | feature | Skip | L | P3 |
| [#692](https://github.com/mhutchie/vscode-git-graph/pull/692) | docs: expand on `showSpecificBranches` glob pattern docs | strazto | 2022-08-25 | +1/-1 | docs | Already irrelevant to our base | S | - |
| [#647](https://github.com/mhutchie/vscode-git-graph/pull/647) | fix 645: add reverse order | i11010520 | 2022-04-18 | +215/-125 | feature | Import by re-implementation | L | P3 |
| [#637](https://github.com/mhutchie/vscode-git-graph/pull/637) | fix(web): file tree error when a folder is named `constructor` | pavlelee | 2022-03-23 | +7/-6 | fix | Import by re-implementation | S | P0 |
| [#602](https://github.com/mhutchie/vscode-git-graph/pull/602) | Add "Copy short Commit Hash to Clipboard" button | Chrismettal | 2021-12-16 | +7/-0 | feature | Import by re-implementation | S | P1 |
| [#601](https://github.com/mhutchie/vscode-git-graph/pull/601) | Change abbreviated commit hash length to 7 chars | Chrismettal | 2021-12-16 | +3/-3 | feature | Import by re-implementation | S | P2 |
| [#580](https://github.com/mhutchie/vscode-git-graph/pull/580) | localize for zh-cn | takegine | 2021-10-20 | +85/-40 | i18n | Skip | L | P3 |
| [#573](https://github.com/mhutchie/vscode-git-graph/pull/573) | Add commit fixup and rebase with autosquash | bkmeneguello | 2021-10-03 | +58/-6 | feature | Import by re-implementation | M | P2 |
| [#488](https://github.com/mhutchie/vscode-git-graph/pull/488) | View alternate parent changes at merge commits | dan1994 | 2021-03-20 | +292/-68 | feature | Import by re-implementation | M | P2 |
| [#473](https://github.com/mhutchie/vscode-git-graph/pull/473) | Add "CI/CD Status" column | keydepth | 2021-03-07 | +5701/-77 | feature | Ask author to resubmit under MIT | L | P3 |
| [#394](https://github.com/mhutchie/vscode-git-graph/pull/394) | Add sticky header option | bendera | 2020-10-12 | +70/-11 | feature | Import by re-implementation | M | P1 |

Counts: Import by re-implementation 16, Ask author to resubmit under MIT 1, Skip 2, Already irrelevant to our base 2.

## Per-PR notes

### #939 Add `git-graph.excludeBranchGlobPatterns` setting (rustyx)

Adds a setting listing glob patterns; branches that match are left out of the graph when "all branches" is shown, plus a "Show Excluded Branches" toggle whose state is remembered globally. Users with many bot or sync branches (`sync/*`, `remotes/origin/experimental/*`) want a clean "All" view (upstream issue #360).
Touches in our base: `package.json` (new setting), `src/config.ts`, `src/dataSource.ts` (`getGitLog` builds `log --branches --tags --remotes`; add `--exclude=<glob>` arguments before each ref selector), `src/extensionState.ts` (remember the toggle), `src/gitGraphView.ts`, `web/main.ts` (toggle control next to "Show Remote Branches"). Our base has no `customBranchGlobPatterns`, so this is a stand-alone feature here.
License: edits to restricted code in six files plus a large test file; nothing to reuse. Re-implement from the description.
Recommendation: Import by re-implementation. Start with the backend setting (small); the toggle can follow.

### #936 Add an Allow Empty Commits option to the Cherry Pick dialog (senwong)

Adds an "Allow Empty Commits" checkbox (and default setting) so cherry picking an empty or already-applied commit succeeds via `--keep-redundant-commits` instead of failing. Useful for people who replay commits between long-lived branches.
Touches in our base: `src/dataSource.ts` `cherrypickCommit` (add the flag), `src/types.ts` request type, `src/gitGraphView.ts` handler, `web/main.ts` (the cherry pick action currently uses `showConfirmationDialog`/`showSelectDialog`; switch to `showFormDialog`, which already supports checkboxes). Our base has no "No Commit" option, so the interaction note in the PR does not apply.
License: small edits to restricted code throughout. Re-implement.
Recommendation: Import by re-implementation, S, P2.

### #933 Display the tags on a commit in the Commit Details View (travisluong)

Adds a "Tags" row to the Commit Details View summary listing every tag on the commit, because tag labels on the graph row get truncated when a commit has several tags (upstream issue #777). Frontend only.
Touches in our base: `web/main.ts` `showCommitDetails` (the summary already prints Parents, Author, Committer; the commit's `refs` array with `type === 'tag'` is available via `this.commits[this.commitLookup[hash]]`), `media/main.css`. Our base has no "show tags" repository setting, so the row can always be shown.
License: a handful of lines edited inside restricted functions. Re-implement.
Recommendation: Import by re-implementation, S, P1 (cheap and visible).

### #929 Add keyboard repository switching (joboyx)

Two parts: Up/Down/Enter navigation in the dropdown filter (so a filtered repo or branch can be picked without the mouse; upstream issue #484), and a "Git Graph: Switch Repository..." command that opens a VS Code QuickPick of known repos (partially upstream issue #736).
Touches in our base: `web/dropdown.ts` (filter input already exists, add key handling and a highlighted item), `media/dropdown.css`, `package.json` and `src/extension.ts` (new command; our base has no `src/commands.ts`), `src/gitGraphView.ts` (`createOrShow` has no way to open on a given repo yet; add a "load this repo" message or parameter), `src/repoManager.ts` (list of repos).
License: `commands.ts` additions are author-written but hang off restricted scaffolding; dropdown changes edit restricted code. Re-implement.
Recommendation: Import by re-implementation. Do the dropdown keyboard part first (S); the QuickPick command is M.

### #920 Add "Copy All Relative File Paths to Clipboard" to commit and file context menus (TERAKITERAKICHI)

Adds a context menu action on a commit row and on the Commit Details file list that copies every changed file path (newline separated) via the existing `copyToClipboard` message. Handy for pasting file lists into reviews or scripts. The +7599 is almost entirely a committed `package-lock.json`; the real change is about 33 lines in `web/main.ts`.
Touches in our base: `web/main.ts` commit context menu (next to "Copy Commit Hash to Clipboard") and the file tree context handling; `fileChanges[].newFilePath` is already in `GitCommitDetails`. Backend `copyToClipboard` already exists.
License: inline additions to restricted `web/main.ts`; do not take the lock file. Re-implement.
Recommendation: Import by re-implementation, S, P2.

### #919 Add HEAD option to branch selector dropdown (TomKalina)

Adds a "HEAD (branch-name)" entry to the branch dropdown that always resolves to the checked-out branch, so the graph follows checkouts without re-selecting. Useful for people who keep the view on the current branch.
Touches in our base: `web/main.ts` `loadBranches` (builds options for `branchDropdown`, which is single-select here) and the place that sends `loadCommits` with `branchName`; `web/utils.ts` constant. The branch head is already returned by `getBranches`. Our base has `showCurrentBranchByDefault`, which this complements.
License: small edits to restricted code; PR body notes it was AI-generated. Re-implement.
Recommendation: Import by re-implementation, S, P2.

### #910 Add signature status column to commit table (MatriQ)

Adds a column showing GPG/SSH signature status per commit (good, bad, untrusted, missing) with signer and key in a tooltip, by adding `%G?`, `%GS`, `%GK` to the log format. Wanted by teams that enforce signed commits (upstream issue #909).
Touches in our base: `src/dataSource.ts` `gitLogFormat` and the parser in `getGitLog`, `src/types.ts` `GitCommitNode`, `web/main.ts` table header and row rendering (columns are hard-coded here), `media/main.css`. Our base has no `defaultColumnVisibility` setting; either add a dedicated boolean setting or first add column visibility (prerequisite, M).
License: edits to restricted code. Re-implement. Note `%G?` makes git invoke gpg per commit, so it should be opt-in.
Recommendation: Import by re-implementation, M, P2.

### #907 Add icon to new `scm/repository` menu (InigoMoreno)

Recent VS Code moved the per-repository actions in the Source Control view to a new `scm/repository` menu, so upstream's Git Graph button disappeared there (upstream issue #903). The PR adds the same menu entries under `scm/repository`.
Touches in our base: `package.json` `contributes.menus` only. Our base has no menus at all (the `scm/title` button and the `sourceCodeProviderIntegrationLocation` setting came after 1.4.6), so the feature "Git Graph button in the SCM view" has to be added first; when we do, add both `scm/title` and `scm/repository` entries with a `scmProvider == git` condition and an icon from `resources/`.
License: declarative `package.json` entries; nothing copyrightable of substance, but write our own anyway.
Recommendation: Import by re-implementation (as "add SCM view button"), S, P1.

### #842 Change activation to `onStartupFinished` (JustinGrote)

Changes `activationEvents` from `*` to `onStartupFinished` so the extension does not slow down VS Code startup.
Our base: `package.json` already has `"activationEvents": ["onStartupFinished"]`, so there is nothing to do.
Recommendation: Already irrelevant to our base.

### #763 Add "show HEAD" button (Timmmm)

Adds a control-bar button that scrolls to and highlights the checked-out commit, for when HEAD is far down the graph or detached. Five community comments ask for it; the thread also discusses the upstream license problem.
Touches in our base: `src/gitGraphView.ts` HTML template (`#controls` next to `#refreshBtn`), `web/main.ts` (`commitHead` and `commitLookup` are known; reuse the `window.scrollTo` logic used for the Commit Details View), `media/main.css`. Needs a small icon (use a codicon or our own SVG).
License: edits to restricted code. Re-implement.
Recommendation: Import by re-implementation, S, P1. A later step could also follow the comment suggestion to give all control buttons a shared `.btn` class.

### #742 A better diff viewer - Diff2HTML support (homsai)

Prototype of an in-extension diff viewer built on diff2html and jQuery, with revert and open-file actions. The author explicitly labeled it a non-mergeable proof of concept and later shipped it as a separate extension; a commenter also argued it belongs in its own extension.
Touches in our base: would add `src/gitDiffView.ts` and bundled third-party assets, and change `src/diffDocProvider.ts` behavior. Large, pulls in vendored libraries, and duplicates VS Code's own diff editor.
License: mostly author-written new files, but superseded by the author's own extension.
Recommendation: Skip. Point users to the author's stand-alone extension instead.

### #692 docs: expand on `showSpecificBranches` glob pattern docs (strazto)

One-line description tweak to the `git-graph.repository.onLoad.showSpecificBranches` setting clarifying that glob entries must exist in `customBranchGlobPatterns`.
Our base has neither setting, so there is nothing to document. If we later implement custom branch glob patterns (see #939), write the setting description with this clarification from the start.
Recommendation: Already irrelevant to our base.

### #647 fix 645: add reverse order (i11010520)

Adds an option to list commits oldest-first (`git log --reverse`), with graph and paging changes to match (upstream issue #645). Niche, but asked for by people reviewing history chronologically.
Touches in our base: `src/dataSource.ts` `getGitLog` (currently `--date-order` only, with `--max-count` paging that `--reverse` breaks because git reverses after limiting), `web/graph.ts` (`loadCommits`/`determinePath` assume children appear before parents), `web/main.ts` (uncommitted-changes row placement, "load more" direction), `src/config.ts`, `package.json`. A simpler path is to reverse the array in the frontend and adapt the renderer.
License: substantial edits to restricted code. Re-implement.
Recommendation: Import by re-implementation, L, P3. Consider adding a commit ordering setting (date/author-date/topo) at the same time.

### #637 fix(web): file tree error when a folder is named `constructor` (pavlelee)

Bug: a folder named `constructor` (or any `Object.prototype` key such as `toString`) makes the Commit Details View spin forever, because the file tree builder checks `typeof cur.contents[name] === 'undefined'` on a plain object. A later comment suggests `Object.prototype.hasOwnProperty.call`.
Our base has the same bug: `web/main.ts` `generateGitFileTree` uses `contents: GitFolderContents = {}` and the same `typeof` check. Fix by using `Object.create(null)` or a `Map` for `contents` and `hasOwnProperty` checks, and audit `generateGitFileTreeHtml` and the folder toggle code that index `contents` by name.
License: a standard JavaScript fix; write it ourselves.
Recommendation: Import by re-implementation, S, P0.

### #602 Add "Copy short Commit Hash to Clipboard" button (Chrismettal)

Adds a context menu item that copies the abbreviated hash. Two community approvals and two later "please merge" comments; the long hash is noisy in chat and CLI commands.
Touches in our base: `web/main.ts` commit context menu, right after "Copy Commit Hash to Clipboard" (uses `abbrevCommit` and the existing `copyToClipboard` message). Nothing else.
License: seven inline lines in restricted code. Re-implement.
Recommendation: Import by re-implementation, S, P1.

### #601 Change abbreviated commit hash length to 7 chars (Chrismettal)

Changes `abbrevCommit` from 8 to 7 characters to match git's usual default.
Touches in our base: `src/utils.ts` `abbrevCommit` (currently `substring(0, 8)`) and the duplicate helper at the bottom of `web/main.ts`. Git's `core.abbrev` is auto-scaled and many large repos use more than 7, so a hard-coded 7 is not strictly better; a `git-graph.abbrevCommitLength` setting (default 8, range 4 to 40) serves both camps and pairs well with #602.
License: trivial; write it ourselves.
Recommendation: Import by re-implementation as a setting, S, P2.

### #580 localize for zh-cn (takegine)

Chinese translation done by wrapping UI strings in `web/main.ts` with a lookup function and shipping a `zh-cn.json`; by the author's own description it is meant to be applied by overwriting local files, not wired into the build. Comments suggest `vscode-nls` instead and note other published Chinese forks.
Touches in our base: every user-visible string in `web/main.ts`, `src/gitGraphView.ts`, `package.json` (`package.nls.json`). Our base has no localization infrastructure; a real i18n effort would use VS Code's `l10n`/`package.nls.*.json` mechanisms.
License: translation strings are the author's work; the wrapping edits are to restricted code.
Recommendation: Skip for now. If we add i18n, do it with `vscode.l10n` and invite translators (this author included) to contribute translation files under MIT.

### #573 Add commit fixup and rebase with autosquash (bkmeneguello)

Two features: a "Fixup" action on a commit (`git commit --fixup=<hash>` of staged changes) and an "autosquash" option for interactive rebase (upstream issue #410). Has one approval and several "please merge" comments; a reviewer noted the PR bundles two features and that the base behavior of `rebase.autoSquash` should be respected.
Touches in our base: `src/dataSource.ts` (new `fixupCommit`; our base has no rebase at all), `src/types.ts`, `src/gitGraphView.ts`, `web/main.ts` commit context menu, `src/config.ts`. The autosquash half depends on first implementing rebase (and interactive rebase runs in a terminal, which also does not exist in our base).
License: edits to restricted code. Re-implement.
Recommendation: Import by re-implementation. Fixup alone is S; autosquash is part of a later "rebase" feature (M overall, P2).

### #488 View alternate parent changes at merge commits (dan1994)

For a merge commit, lets the user view file changes relative to a parent other than the first (upstream issue #384), via a context menu on the parent hashes and a toggle button in the Commit Details View. The upstream maintainer reviewed it in depth, approved the design, and was about to merge; a stash edge case was the last open item.
Touches in our base: `src/dataSource.ts` `commitDetails` (`diff-tree ... <hash>` compares to the first parent; take a parent index and use `<parent>..<hash>`), `src/types.ts`, `src/gitGraphView.ts`, `web/main.ts` `showCommitDetails` (parents are plain text here; make them links with a context menu). Our base has no stashes, so that edge case does not apply yet.
License: edits spread through restricted code. Re-implement from the issue and review thread, which document the agreed UX well.
Recommendation: Import by re-implementation, M, P2.

### #473 Add "CI/CD Status" column (keydepth)

Adds a column and Commit Details View section showing CI/CD build status fetched from GitHub Actions and GitLab, with a provider/token settings dialog, encrypted token storage, and caching (upstream issue #462). Went through two maintainer review rounds; the maintainer flagged misleading partial results from the GitHub API, and the author then limited it to the Commit Details View. The upstream maintainer stopped responding in 2021.
Touches in our base: new `src/cicdManager.ts` (modeled on our existing `src/avatarManager.ts`), `src/extensionState.ts`, `src/gitGraphView.ts`, `web/main.ts`, settings UI (our base has no settings widget or dialog module, so provider configuration would need to live in VS Code settings plus a command for the token).
License: `cicdManager.ts` (817 lines) and its tests (3790 lines) are self-contained author code; the rest are edits to restricted code. A good candidate to ask the author to re-submit under MIT.
Recommendation: Ask author to resubmit under MIT; otherwise re-implement later. L, P3 (network, secrets, and API maintenance burden).

### #394 Add sticky header option (bendera)

Keeps the control bar and the table column headers fixed while the graph scrolls (upstream issue #132). The most requested change in the queue: 31 comments, people shipping private builds with it, and the maintainer confirmed the core worked, with remaining items about control-bar overflow, scroll shadow, and the context menu while scrolling.
Touches in our base: `src/gitGraphView.ts` HTML (`#controls`, `#tableColHeaders`, `#scrollShadow`), `media/main.css` (`position: sticky`, z-index over the graph SVG), `web/main.ts` (context menu is inline here; make it `position: fixed` or close it on scroll; column resize code reads header offsets), `package.json`/`src/config.ts` for a `stickyHeader` setting. Our base has fewer controls, so the overflow problem is smaller.
License: edits to restricted code and CSS. Re-implement; the review thread lists the edge cases to test.
Recommendation: Import by re-implementation, M, P1.

## Suggested import order

1. #637 fix `constructor` folder bug (P0, S). Pure bug fix; also check the other `Object.prototype` names.
2. #602 copy short commit hash (P1, S), together with #601 as an `abbrevCommitLength` setting (P2, S).
3. #907 Git Graph button in the Source Control view, with both `scm/title` and `scm/repository` menus (P1, S).
4. #933 tags row in the Commit Details View (P1, S).
5. #763 "show HEAD" button (P1, S); add a shared button class while touching the control bar.
6. #394 sticky header (P1, M).
7. #939 exclude branch glob patterns setting, then the toggle (P1, M).
8. #929 keyboard navigation in dropdowns, then the "Switch Repository" command (P1, S then M).
9. #919 HEAD entry in the branch dropdown (P2, S).
10. #920 copy all changed file paths (P2, S).
11. #936 cherry pick "allow empty" checkbox (P2, S).
12. #573 fixup commit action (P2, S); autosquash once rebase exists.
13. #488 view changes against an alternate parent (P2, M).
14. #910 signature status column, after a column-visibility setting (P2, M).
15. #647 reverse / configurable commit ordering (P3, L).
16. #473 CI/CD status: contact the author about an MIT re-submission before any work (P3, L).

Not planned: #742 (Skip, author ships it as a separate extension), #580 (Skip until we have an l10n framework), #842 and #692 (already irrelevant to our base).
