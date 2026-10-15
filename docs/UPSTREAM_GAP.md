# Upstream feature gap: 1.4.6 (MIT) to 1.31.0-beta.3

## Why this document exists

This fork (`erancihan/vscode-git-graph`) branches from upstream
`mhutchie/vscode-git-graph` at commit `4af8583` (version 1.4.6, 2019-05-09).
That is the last commit that upstream published under the MIT License. With
the next commits ("Updated License", 2019-05-10) upstream moved to a
restrictive license. That license forbids publishing or distributing
derivative works.

Upstream kept shipping for two more years. The gap is 363 commits, 28 tagged
releases (1.5.0 through 1.30.0, patch releases included) and four 1.31.0
betas. It ends at `d7f43f4`
(v1.31.0-beta.3, 2021-09-19). None of that code can be used here.

## The rule for this fork

Every item in this document is re-implemented from scratch. The only input is
the description of the behavior: what the feature does, which setting or
command controls it, and which issue asked for it. Do not open upstream source
files, diffs, CSS, HTML templates or test code after `4af8583` while you
write code. Do not copy, adapt or paraphrase them into this repository.

Issue numbers refer to `https://github.com/mhutchie/vscode-git-graph/issues/<n>`.
They make the behavior traceable. They are facts, not code.

These facts are safe to use:

- Feature behavior as described in public.
- Issue numbers and titles.
- Release dates.
- Extension setting names and their enum values.
- Command identifiers and titles.
- The names of VS Code APIs.

The setting and command names stay identical. Users can then move their
`settings.json` entries between the two extensions.

The fork's `package.json` already reports version 2.0.0 and requires VS Code
`^1.74.0`. Some of the "modernization" work in the roadmap is therefore
partly done.

---

## Release-by-release gap

Dates come from the upstream changelog and the upstream release tags.
"Internal" rows come from commit subjects in the upstream history
(`git log 4af8583..d7f43f4`) that have no changelog line.

### 1.5.0 - 2019-05-15

| Type | Change |
|---|---|
| Feature | Compare two commits: with the Commit Details View open, Ctrl/Cmd-click another commit to see the diff between them (#29) |
| Feature | Squash option on the merge-branch and merge-commit dialogs (#63) |
| Feature | Delete a remote branch from the remote branch context menu (#64) |
| Feature | Keyboard shortcuts: Up/Down to step through commits in the details view, Ctrl/Cmd+R to refresh, Enter to submit a dialog (#73) |
| Feature | Option to dock the Commit Details View at the bottom of the view instead of inline (#74) |
| Feature | Tooltip on repo dropdown items that shows the full path of the repository (#60) |
| Fix | Non-ASCII file names shown correctly in the Commit Details View (#62) |
| Internal | Packaging and front-end code cleanup |

### 1.6.0 - 2019-05-24

| Type | Change |
|---|---|
| Feature | Uncommitted changes become a clickable row: view them, compare any commit against them, and a context menu with reset to HEAD, clean untracked files, open SCM view (#36) |
| Feature | Multi-select branches in the Branches dropdown (#77) |
| Feature | User-defined glob patterns in the Branches dropdown via `customBranchGlobPatterns` (#49) |
| Feature | Three alignment modes for branch and tag labels: normal, or branches left and tags right, or branches on the graph and tags right (#71) |
| Feature | Matching local and remote labels on the same commit merge into one label. A setting turns this off (#78) |
| Feature | `retainContextWhenHidden` setting for instant tab restore at the cost of memory (#30) |
| Feature | "View Git Graph" entry on the SCM provider title, inline or under "More actions" (#76) |
| Feature | Choose whether the VS Code diff opens in the active group or beside it (#85) |
| Feature | Support for repositories with very many tags and refs (#81) |
| Feature | Support for VS Code Remote Development (#83) |
| Internal | Better use of `git diff` and `diff-tree`. Part of #83 was reverted after Microsoft fixed the webview bug |

### 1.7.0 - 2019-05-29

| Type | Change |
|---|---|
| Feature | Rebase the current branch onto any branch or commit from the context menu (#34) |
| Feature | "Fetch from Remote(s)" button on the control bar (visible only for repositories with remotes). Refresh button redesigned (#57) |
| Feature | Toggle Date / Author / Commit columns from the column header context menu, with `defaultColumnVisibility` (#79) |
| Feature | Stronger visual emphasis on the checked-out branch label (#87) |
| Internal | More stable remote-name handling |

### 1.8.0 - 2019-06-08

| Type | Change |
|---|---|
| Feature | Command "Add Git Repository" to register extra repositories such as sub-repos (#90) |
| Feature | Setting to open the view to the repository of the active editor's document (#91) |
| Feature | UX pass: show the running action's name, keep scroll position across actions, spinner on refresh, `retainContextWhenHidden` on by default (#92) |
| Feature | Push tag: offered only for repositories with remotes, auto-picks a single remote, asks for a choice between several (#93) |
| Feature | Push branch from the local branch context menu, same remote rules as #93 (#94) |
| Internal | Loading indicator for details and comparison views. More consistent git error handling |

### 1.9.0 - 2019-06-23

| Type | Change |
|---|---|
| Feature | Find widget (Ctrl/Cmd+F): search message, date, author, hash, branch and tag names. Case-sensitive and regex modes (#31) |
| Feature | "Pull into current branch" on the remote branch context menu (#98) |
| Feature | Merge commits rendered with muted text, controlled by a setting (#100) |
| Feature | Emoji shortcodes (gitmoji included) replaced in commit messages. Custom mappings via `customEmojiShortcodeMappings` (#104) |
| Feature | Display remote SVN branches (#107) |
| Feature | "Delete Tag" can also delete the tag on a remote (#109) |
| Fix | Troubleshooting guidance for repositories in subfolders (#105) |
| Internal | Error dialog handling improved. Front-end performance work |

### 1.10.0 - 2019-07-02

| Type | Change |
|---|---|
| Feature | Open-file button next to each file in the details and comparison file tree (#108) |
| Feature | Askpass: prompt for remote credentials on demand from a git command (#114) |
| Feature | HTTP(S) URLs in commit bodies become clickable links (#116) |
| Fix | "Delete Remote Branch" on an already-deleted remote branch removes the tracking ref instead of an error (#115) |

### 1.11.0 - 2019-07-13

| Type | Change |
|---|---|
| Feature | Repository Settings widget (gear icon) to list, add, edit and delete remotes (#95) |
| Feature | Commit ordering setting: date, author-date, or topo (#117) |
| Feature | "Check out" option on the Create Branch dialog (#119) |
| Feature | Remember the "Show Remote Branches" checkbox per repository (#123) |
| Feature | Avatar fetching for SSH GitHub and GitLab remotes (#125) |
| Feature | With "Show All" selected, include a detached HEAD commit (for example during a rebase) (#126) |
| Internal | Moved most `child_process.exec` usage to `spawn` |

### 1.12.0 - 2019-07-21

| Type | Change |
|---|---|
| Feature | Output Channel logging of every git command and core extension events (#129) |
| Feature | Handle repositories with 1000+ branches (#130) |
| Feature | Checkout of a remote branch whose local name exists prompts to rename or to check out the existing branch (#131) |
| Feature | Git executable detection matches the built-in Git extension. Two new error pages replace the old failure page (#135) |
| Feature | "View Details" for annotated tags (tagger, date, message) (#136) |
| Internal | Remaining `exec` calls replaced with `spawn` |

### 1.12.1 - 2019-07-23

| Type | Change |
|---|---|
| Feature | Tag details include object and commit hashes (#141) |
| Feature | Copy-path button for every file in the details and comparison file tree (#142) |
| Fix | Wrong file path for "open current version of a file" in a VS Code window opened on a subfolder (#137) |

### 1.13.0 - 2019-08-16

| Type | Change |
|---|---|
| Feature | Respect `.mailmap` for author and committer names and emails (#143) |
| Feature | Settings for the default state of the Add Tag, Create Branch, Merge and Rebase dialogs (#145) |
| Feature | Command "Remove Git Repository" (#146) |
| Feature | `integratedTerminalShell` setting (user scope only) for the terminal used by interactive rebase (#149) |
| Feature | `fileEncoding` setting for reading historical file contents (#150) |
| Feature | Fetch-and-prune setting for the control bar Fetch button. Fetch or prune a single remote from the settings widget (#154) |
| Feature | A click on a known sub-repository in the file tree loads it in the view (#155) |
| Feature | Force-push option on the Push Branch dialog (#159) |
| Fix | Better repository management across VS Code and git workflows (#158) |
| Fix | Strip shell color codes from branch names under `color.branch=always` (#160) |
| Internal | Non-staged deleted files included in the file tree. Find widget usable in narrow views |

### 1.14.0 - 2019-09-02

| Type | Change |
|---|---|
| Feature | Code Review mode: track reviewed files per commit or comparison. Bold unreviewed files. Persists across sessions (#122) |
| Feature | "Eye" indicator on the last file viewed (#122) |
| Feature | Drag to resize the Commit Details View height and its divider. Stored per repository (#151) |
| Feature | Higher-resolution avatars for high-DPI displays (#164) |
| Fix | View a branch that shares its name with a file (#163) |
| Fix | Switch to the git executable from `git.path` after the user changes it (#165) |
| Fix | Race condition that truncated stdout of some git commands (#168) |
| Internal | Context menu placement on small views. Symbolic-link repository handling |

### 1.15.0 - 2019-09-13

| Type | Change |
|---|---|
| Feature | Stash support: stashes on the graph, context menu (apply, branch from, drop, copy name/hash), "Stash uncommitted changes", details and comparison views for stashes (#48) |
| Feature | Auto-register submodules listed in `.gitmodules` (#173) |
| Feature | "Drop" action for a single commit with no branching in its children (#174) |
| Feature | Double-click "Show All" to select or unselect every branch (#175) |
| Feature | Path hints in the Repo dropdown for repositories that share a name (#177) |
| Feature | Setting to hide commits that are referenced only by tags (#178) |
| Fix | Stop VS Code from requesting `package.json` through the document provider on README diffs (#172) |
| Internal | Graph renderer refactor with performance gain. Boolean coercion for settings. Event overlay class |

### 1.16.0 - 2019-09-22

| Type | Change |
|---|---|
| Feature | Hover tooltip on a graph vertex: does HEAD include it, and which branches, tags and stashes contain it (#156) |
| Feature | Delete Branch dialog can also delete the branch on remote(s) (#161) |
| Feature | "Pop" action on the stash context menu (#180) |
| Feature | Default-state settings for Reset Current Branch, Reset Uncommitted Changes and Stash Uncommitted Changes dialogs (#181) |
| Feature | Graph construction and layout rewrite with a better visualization and support for topological analysis (#183) |
| Internal | Standardized request and response message interfaces. `readonly` annotations. Simpler initial state plumbing |

### 1.17.0 - 2019-10-08

| Type | Change |
|---|---|
| Feature | "Fetch into local branch" on remote branches with a same-named, non-checked-out local branch (#128) |
| Feature | Date format options "ISO Date & Time" and "ISO Date Only" (#185) |
| Feature | "Push to remote" option on the Add Tag dialog with a default setting (#186) |
| Feature | "No Commit" option on the Cherry Pick dialog (#188) |
| Feature | Show or hide the branches of individual remotes from the settings widget (#190) |
| Fix | File names that contain double quotes in the Commit Details View (#189) |
| Fix | File names that contain `#` or `?` in the diff view (#192) |
| Internal | Migration from the `vscode` npm package to `@types/vscode` (#191). Const enums. Custom themed checkboxes. CSS moved into `web/styles/` |

### 1.18.0 - 2019-11-05

| Type | Change |
|---|---|
| Feature | File List view as an alternative to the File Tree, default via setting and overridable per repo (#202) |
| Feature | `contextMenuActionsVisibility` setting to hide individual context menu actions (#198) |
| Feature | "Reinstate Index" option on apply-stash and pop-stash (#204) |
| Feature | Dialogs use custom input controls styled to the active color theme (#205) |
| Fix | Better default column widths on narrow views (#197) |
| Internal | Ref labels highlighted on hover and while a menu or dialog targets them |

### 1.19.0 - 2019-11-27

| Type | Change |
|---|---|
| Feature | Issue Linking: a regex plus a URL template per repository turns issue references into links. Set up in the settings widget (#220) |
| Feature | Untracked files of a stash shown in the Commit Details View (#208) |
| Feature | Default setting for the "Force Delete" checkbox on Delete Branch (#213) |
| Feature | "Open Git Graph Extension Settings" button in the settings widget (#215) |
| Feature | "Show Tags" setting, overridable per repository (#216) |
| Feature | Ctrl/Cmd+H scrolls to the HEAD commit (#218) |
| Fix | Handle Electron `*.asar` paths by use of Node's `fs` module (#209) |
| Internal | Push dialogs default to `origin` in multi-remote repositories. Find widget gets up/down icons, tooltips and Shift+Enter. TypeScript 3.7. CI moved to GitHub Actions |

### 1.19.1 - 2019-11-27

| Type | Change |
|---|---|
| Fix | Remote Development compatibility regression from 1.19.0 (#221) |

### 1.20.0 - 2019-12-24

| Type | Change |
|---|---|
| Feature | Mute commits that are not ancestors of HEAD (#139) |
| Feature | Setting to scroll to HEAD on repository open or switch (#219) |
| Feature | Issue Linking: "use globally" default, plus auto-detection of common issue patterns to prefill the regex (#223) |
| Feature | Preserve leading whitespace in commit and tag messages (#227) |
| Feature | "Always Accept" checkbox on the Checkout Commit dialog (#233) |
| Feature | Stashes drawn differently from regular commits (#237) |
| Fix | Resolve symbolic links on open from the SCM view (#222) |
| Fix | Cap the width of control bar dropdowns for narrow viewports and long names (#232) |
| Internal | Getters on the `Config` class. View state restoration improvements |

### 1.21.0 - 2020-01-13

| Type | Change |
|---|---|
| Feature | Edit local and global git user name and email from a "User Details" section in the settings widget (#225) |
| Feature | "Force With Lease" option on Push Branch (#239) |
| Feature | Show commit signature status in the details view, behind a setting (#240) |
| Feature | Auto-load more commits at the bottom of the scroll, with a setting to disable (#241) |
| Feature | Parent hashes in the details view are clickable (#243) |
| Internal | Overhaul of data loading and refresh. Event delegation for faster table render. New radio input type. Better Output Channel records |

### 1.22.0 - 2020-03-21

| Type | Change |
|---|---|
| Feature | Command "Resume a specific Code Review in Workspace" (#231) |
| Feature | "No Commit" option on Merge dialogs with a default setting (#248) |
| Feature | Pull Request Creation integration: built-in Bitbucket, GitHub and GitLab, custom providers via `customPullRequestProviders`, "Create Pull Request" on branch menus (#250) |
| Feature | "Record Origin" option on Cherry Pick with a default setting (#251) |
| Feature | Command "End a specific Code Review in Workspace" (#253) |
| Feature | Add Tag dialog shows the most recent tag as a hint (#255) |
| Feature | Tooltip on the HEAD hollow-circle indicator (#259) |
| Feature | Issue Linking supports multiple capture groups and `$1`, `$2` placeholders (#262) |
| Feature | Show stashes based on commits of deleted branches (#266) |
| Feature | "Copy Commit Subject to Clipboard" action (#267) |
| Feature | Details view shows both the author date and the commit date on a mismatch, plus the committer email (#269) |
| Fix | Correct file list for merge commits in the details view (#274) |
| Internal | CommandManager refactor. EventEmitter-based back end. JSDoc on all back-end code. `fs.access` instead of `fs.exists`. Faster count of uncommitted changes |

### 1.23.0 - 2020-05-24

| Type | Change |
|---|---|
| Feature | "Include commits only mentioned by reflogs" repository option with a global default (#89) |
| Feature | Ctrl/Cmd+S and Ctrl/Cmd+Shift+S jump to the next or previous stash (#201) |
| Feature | Open the diff in a specific editor group (One through Nine) (#277) |
| Feature | Flash the HEAD commit after Ctrl+H (#283) |
| Feature | Setting to exclude untracked files from uncommitted changes (#285) |
| Feature | "View File at this Revision" button per file (#286) |
| Feature | "Only follow the first parent" repository option with a global default (#287) |
| Feature | Create a `.tar` or `.zip` archive from a branch or tag context menu (#292) |
| Feature | Ctrl/Cmd+Up/Down moves to the child or parent commit on the same branch (#299) |
| Fix | CJK IME Enter events submit dialogs on macOS (#279) |
| Fix | Scroll bars in dialog dropdowns with many items (#303) |
| Internal | Jest test framework added. Install, update and uninstall life-cycle hooks. Packaging script improvements |

### 1.24.0 - 2020-06-14

| Type | Change |
|---|---|
| Feature | Run inside VS Code in the browser (Codespaces and similar hosts) (#271) |
| Feature | Checkout of an existing local branch from a remote branch also pulls (#297) |
| Feature | Per-repository commit ordering override from the column header menu (#304) |
| Feature | New gitmoji shortcodes (#316) |
| Feature | `enhancedAccessibility` setting: A/M/D/R/U text indicators in the details view (#319) |
| Internal | Minimum VS Code raised to 1.38.0. `asWebviewUri` and `cspSource` (#305). Back-end unit test coverage expanded |

### 1.25.0 - 2020-07-26

| Type | Change |
|---|---|
| Feature | "Open a Terminal for this Repository" control bar button (#293) |
| Feature | `repositoryDropdownOrder` setting (Full Path or Name) (#321) |
| Feature | "Merge into current branch" on the remote branch context menu (#322) |
| Feature | Default setting for Cherry Pick "No Commit" (#327) |
| Feature | Squash message format setting (Git Graph default or git `SQUASH_MSG`) for merge and pull (#331) |
| Feature | Default-state settings for the Pull Branch dialog (#336) |
| Feature | Compact single-child folders in the file tree, with a setting to disable (#337) |
| Internal | Yes/No dialogs use "Yes, <verb>" and "Cancel". Keyboard shortcut handling rework. Full DataSource and git-detection test coverage |

### 1.26.0 - 2020-09-13

| Type | Change |
|---|---|
| Feature | Choose the branches shown on first load of a repo, per repo or via `onLoad.showCheckedOutBranch` and `onLoad.showSpecificBranches` (#318) |
| Feature | `repository.showRemoteBranches` default setting (#341) |
| Feature | Prune tags on fetch, plus a "Fetch Remote" dialog with prune options for a single-remote fetch (#356) |
| Feature | Custom display name per repository in the settings widget (#357) |
| Feature | Up/Down keys scroll the view while no commit is selected (#359) |
| Feature | Settings renamed into VS Code groups. Old names kept as deprecated fallbacks (#361) |
| Feature | High Contrast theme support (#363) |
| Fix | Better topological check for the availability of "Drop" (#365) |
| Fix | Gravatar lookups are case-insensitive (#369) |
| Fix | Mapped network drives on Windows with git >= 2.25 (#372) |
| Fix | Settings widget no longer requires a global `.gitconfig` (#376) |
| Internal | ESLint replaces TSLint. Disposable superclass. SettingsWidget made scalable. Escape-key precedence in dropdowns |

### 1.27.0 - 2020-11-01

| Type | Change |
|---|---|
| Feature | Settings widget reads `git config` `include` directives (#281) |
| Feature | Inline Markdown (bold, italic, code) in commit messages and tag details, `markdown` setting to disable (#364) |
| Feature | File context menu in the details view (view diff, view at revision, open, copy path) (#381) |
| Feature | Shift modifier on Ctrl/Cmd+Up/Down follows the other branch at forks and merges (#383) |
| Feature | Push a branch or tag to several remotes at once (#385) |
| Feature | Commit hashes in the message body link to that commit's details (#386) |
| Feature | Honor the theme's text selection background color (#389) |
| Feature | Support `git.path` as an array (VS Code 1.50) (#392) |
| Feature | `graph.uncommittedChanges` setting: open circle at the uncommitted row or at the checked-out commit (#393) |
| Feature | Command "Get Version Information" (#398) |
| Internal | TypeScript 4.0, Jest 26. Life-cycle event retry limited to once per release |

### 1.28.0 - 2020-12-01

| Type | Change |
|---|---|
| Feature | Sign commits and tags that the extension creates via `repository.sign.commits` and `repository.sign.tags` (#399) |
| Feature | Rebindable keyboard shortcuts through `keyboardShortcut.*` settings (#406) |
| Feature | `repository.showRemoteHeads` setting to hide `origin/HEAD`-style refs (#407) |
| Feature | New gitmoji shortcodes (#409) |
| Feature | Command "Fetch from Remote(s)" that opens the view and fetches (#412) |
| Feature | Export the repository settings to a committable file for team sharing, and import it (#414) |
| Feature | `fileEncoding` settable at workspace-folder scope (#416) |
| Feature | Merge, Pull, Rebase and Reset dialogs name the current branch (#419) |
| Fix | Horizontally overflowing file names were not clickable (regression from #381) (#420) |
| Internal | AvatarManager refactor with tests. Full RepoManager and CommandManager test coverage. BufferedQueue for file system events. BooleanOverride enum |

### 1.29.0 - 2021-02-28

| Type | Change |
|---|---|
| Feature | Create Branch or Add Tag with an existing name offers to replace it or to pick another name (#390) |
| Feature | Find widget mode that opens the details view for each match as you step through (#402) |
| Feature | Context menu on links (issue links, URLs, emails) to copy the URL (#404) |
| Feature | Select or unselect a branch in the Branches dropdown from its context menu (#417) |
| Feature | Default push remote from `remote.pushDefault`, `branch.<name>.remote` and `branch.<name>.pushRemote` (#424) |
| Feature | Open a directory diff in the `diff.tool` (terminal) or `diff.guitool` (background) from the details view (#426) |
| Feature | One-click force delete dialog after a failed delete of a non-merged branch (#427) |
| Feature | `repository.showStashes` setting, overridable per repository (#429) |
| Fix | Override `log.showSignature` for consistent commit parsing (#452) |
| Internal | `git config` reading overhauled. JSDoc for front-end code. Expanded ESLint rule set. New plus and close icon vectors |

### 1.30.0 - 2021-04-05

| Type | Change |
|---|---|
| Feature | "Force Fetch" option on Fetch into Local Branch to reset a non-checked-out branch to the remote (#395) |
| Feature | "View Diff with Working File" on the file context menu (#457) |
| Feature | "Copy Relative File Path to Clipboard" on the file context menu (#466) |
| Feature | Replace spaces with `-` or `_` in reference inputs via `dialog.general.referenceInputSpaceSubstitution` (#471) |
| Feature | "Open File" action in the diff editor title bar for diffs that the extension opened (VS Code >= 1.42) (#476) |
| Feature | "Workspace Full Path" repository order, now the default (#479) |
| Feature | Git rename detection for the working file of a historical path (#480) |
| Feature | "Mark as Reviewed" and "Mark as Not Reviewed" on files during a code review (#482) |
| Feature | Keyboard shortcut settings accept "UNASSIGNED" (#486) |
| Fix | Markdown inline code no longer changes row height across platforms (#491) |
| Internal | ESLint style issues as warnings. VS Code dev-integration tweaks |

### 1.31.0-beta.0 - 2021-04-12 (tag on `b9112e6`)

| Type | Change |
|---|---|
| Feature | Check and show the signature status of signed tags in the tag details dialog (#498) |
| Fix | Logging: normalize empty arguments and log command invocations (#494) |
| Internal | "Clear Avatar Cache" reports success or failure |

### 1.31.0-beta.1 - 2021-04-18 (tag on `a28d573`)

| Type | Change |
|---|---|
| Feature | Branch names that contain an issue number get a "view issue" context menu action (#499) |
| Internal | Git and VS Code version requirements and `git config` keys refactored into enums |

### 1.31.0-beta.2 - 2021-05-30 (tag on `e1365c9`)

| Type | Change |
|---|---|
| Feature | Warn before a tag push for a commit that is on no known branch of the target remote(s) (#507) |
| Feature | "Reset File to this Revision" on the file context menu (#516) |
| Feature | `contextMenuActionsVisibility` covers the file context menu actions (#517) |
| Internal | Full GitGraphView back-end test coverage. Back-end to front-end message logging. Faster timer-based tests |

### 1.31.0-beta.3 - 2021-09-19 (tag on `d7f43f4`, upstream tip)

| Type | Change |
|---|---|
| Fix | Force-delete of branches on older git versions (#547) |
| Fix | Context menu click event handling (#557) |

---

## Settings added upstream

This list has every `git-graph.*` key that is present in
`contributes.configuration.properties` at `d7f43f4` and absent at `4af8583`.
There are 97 such keys: 78 live settings and 19 deprecated aliases from the
1.26.0 rename (#361). Descriptions are paraphrased.

The 13 settings at the fork point were:

- `autoCenterCommitDetailsView`, `dateFormat`, `dateType`, `fetchAvatars`
- `graphColours`, `graphStyle`, `initialLoadCommits`, `loadMoreCommits`
- `maxDepthOfRepoSearch`, `showCurrentBranchByDefault`, `showStatusBarItem`
- `showUncommittedChanges`, `tabIconColourTheme`

Upstream renamed ten of them (marked "rename of" below). The other three are
unchanged.

### Live settings (78)

| Setting | Description |
|---|---|
| `git-graph.commitDetailsView.autoCenter` | Center the details view on open (rename of `autoCenterCommitDetailsView`) |
| `git-graph.commitDetailsView.fileView.fileTree.compactFolders` | Collapse single-child folders in the file tree |
| `git-graph.commitDetailsView.fileView.type` | Default file view: `File Tree` or `File List` |
| `git-graph.commitDetailsView.location` | Render details `Inline` or `Docked to Bottom` |
| `git-graph.contextMenuActionsVisibility` | Object that hides individual context menu actions |
| `git-graph.customBranchGlobPatterns` | Named glob patterns offered in the Branches dropdown |
| `git-graph.customEmojiShortcodeMappings` | Extra shortcode-to-emoji pairs for commit messages |
| `git-graph.customPullRequestProviders` | Custom PR provider URL templates for PR creation |
| `git-graph.date.format` | Date column format, with ISO variants (rename of `dateFormat`) |
| `git-graph.date.type` | Show author date or commit date (rename of `dateType`) |
| `git-graph.defaultColumnVisibility` | Default visibility of Date, Author, Commit columns |
| `git-graph.dialog.addTag.pushToRemote` | Default for the "push tag to remote" checkbox |
| `git-graph.dialog.addTag.type` | Default tag type: `Annotated` or `Lightweight` |
| `git-graph.dialog.applyStash.reinstateIndex` | Default for "Reinstate Index" on apply stash |
| `git-graph.dialog.cherryPick.noCommit` | Default for "No Commit" on cherry pick |
| `git-graph.dialog.cherryPick.recordOrigin` | Default for "Record Origin" (`-x`) on cherry pick |
| `git-graph.dialog.createBranch.checkOut` | Default for "Check out" on create branch |
| `git-graph.dialog.deleteBranch.forceDelete` | Default for "Force Delete" on delete branch |
| `git-graph.dialog.fetchIntoLocalBranch.forceFetch` | Default for "Force Fetch" on fetch into local branch |
| `git-graph.dialog.fetchRemote.prune` | Default for the prune refs option of a single-remote fetch |
| `git-graph.dialog.fetchRemote.pruneTags` | Default for the prune tags option of a single-remote fetch |
| `git-graph.dialog.general.referenceInputSpaceSubstitution` | Replace spaces in ref names: `None`, `Hyphen`, `Underscore` |
| `git-graph.dialog.merge.noCommit` | Default for "No Commit" on merge |
| `git-graph.dialog.merge.noFastForward` | Default for "always create a merge commit" on merge |
| `git-graph.dialog.merge.squashCommits` | Default for "Squash Commits" on merge |
| `git-graph.dialog.merge.squashMessageFormat` | Squash message: `Default` or `Git SQUASH_MSG` |
| `git-graph.dialog.popStash.reinstateIndex` | Default for "Reinstate Index" on pop stash |
| `git-graph.dialog.pullBranch.noFastForward` | Default for "always create a merge commit" on pull |
| `git-graph.dialog.pullBranch.squashCommits` | Default for "Squash Commits" on pull |
| `git-graph.dialog.pullBranch.squashMessageFormat` | Squash message format for pull |
| `git-graph.dialog.rebase.ignoreDate` | Default for "Ignore Date" on non-interactive rebase |
| `git-graph.dialog.rebase.launchInteractiveRebase` | Default for "Launch Interactive Rebase in terminal" |
| `git-graph.dialog.resetCurrentBranchToCommit.mode` | Default reset mode: `Soft`, `Mixed`, `Hard` |
| `git-graph.dialog.resetUncommittedChanges.mode` | Default reset mode for the working tree: `Mixed`, `Hard` |
| `git-graph.dialog.stashUncommittedChanges.includeUntracked` | Default for "Include Untracked" on stash |
| `git-graph.enhancedAccessibility` | Letter indicators for file change types (color-blind aid) |
| `git-graph.fileEncoding` | Character encoding used to read historical file content |
| `git-graph.graph.colours` | Graph line color palette (rename of `graphColours`) |
| `git-graph.graph.style` | `rounded` or `angular` graph lines (rename of `graphStyle`) |
| `git-graph.graph.uncommittedChanges` | Position of the open circle: uncommitted row or HEAD commit |
| `git-graph.integratedTerminalShell` | Shell executable for terminals that the extension opens (user scope) |
| `git-graph.keyboardShortcut.find` | Keybinding that opens the find widget |
| `git-graph.keyboardShortcut.refresh` | Keybinding that refreshes the view |
| `git-graph.keyboardShortcut.scrollToHead` | Keybinding that scrolls to HEAD |
| `git-graph.keyboardShortcut.scrollToStash` | Keybinding that jumps between stashes |
| `git-graph.markdown` | Render inline Markdown in commit and tag messages |
| `git-graph.openNewTabEditorGroup` | Editor group for diffs and files: `Active`, `Beside`, `One`..`Nine` |
| `git-graph.openToTheRepoOfTheActiveTextEditorDocument` | Open the view on the repository of the active editor |
| `git-graph.referenceLabels.alignment` | Placement of branch and tag labels per row |
| `git-graph.referenceLabels.combineLocalAndRemoteBranchLabels` | Merge matching local and remote labels into one |
| `git-graph.repository.commits.fetchAvatars` | Fetch author avatars (rename of `fetchAvatars`) |
| `git-graph.repository.commits.initialLoad` | Commits loaded at first (rename of `initialLoadCommits`) |
| `git-graph.repository.commits.loadMore` | Commits loaded per "Load More" (rename of `loadMoreCommits`) |
| `git-graph.repository.commits.loadMoreAutomatically` | Load more commits at the bottom of the scroll |
| `git-graph.repository.commits.mute.commitsThatAreNotAncestorsOfHead` | Mute commits outside the ancestry of HEAD |
| `git-graph.repository.commits.mute.mergeCommits` | Mute merge commits |
| `git-graph.repository.commits.order` | Commit ordering: `date`, `author-date`, `topo` |
| `git-graph.repository.commits.showSignatureStatus` | Show GPG signature status in the details view |
| `git-graph.repository.fetchAndPrune` | Prune remote-tracking refs on each Fetch button press |
| `git-graph.repository.fetchAndPruneTags` | Prune tags on each Fetch button press (git >= 2.17) |
| `git-graph.repository.includeCommitsMentionedByReflogs` | Include reflog-only commits in the "all branches" view |
| `git-graph.repository.onLoad.scrollToHead` | Scroll to HEAD on repository load |
| `git-graph.repository.onLoad.showCheckedOutBranch` | Show only the checked-out branch on load (rename of `showCurrentBranchByDefault`) |
| `git-graph.repository.onLoad.showSpecificBranches` | List of branches or globs selected on load |
| `git-graph.repository.onlyFollowFirstParent` | Load commits with `--first-parent` |
| `git-graph.repository.showCommitsOnlyReferencedByTags` | Include commits reachable only from tags |
| `git-graph.repository.showRemoteBranches` | Default for the "Show Remote Branches" checkbox |
| `git-graph.repository.showRemoteHeads` | Show `origin/HEAD`-style symbolic refs |
| `git-graph.repository.showStashes` | Show stashes on the graph |
| `git-graph.repository.showTags` | Show tags on the graph |
| `git-graph.repository.showUncommittedChanges` | Show the uncommitted changes row (rename of `showUncommittedChanges`) |
| `git-graph.repository.showUntrackedFiles` | Count untracked files in uncommitted changes |
| `git-graph.repository.sign.commits` | GPG or X.509 sign commits that the extension creates |
| `git-graph.repository.sign.tags` | GPG or X.509 sign tags that the extension creates |
| `git-graph.repository.useMailmap` | Apply `.mailmap` to author and committer identities |
| `git-graph.repositoryDropdownOrder` | Repo dropdown sort: `Full Path`, `Name`, `Workspace Full Path` |
| `git-graph.retainContextWhenHidden` | Keep the hidden webview alive for instant restore |
| `git-graph.sourceCodeProviderIntegrationLocation` | SCM title button placement: `Inline` or `More Actions` |

### Deprecated aliases added and later superseded (19)

Upstream introduced these flat names between 1.6.0 and 1.25.0 and then
renamed them in 1.26.0 (#361). At `d7f43f4` they still exist with a
deprecation message that points to the grouped name. The fork can support
them as read-through fallbacks, or not at all.

| Deprecated name | Superseded by |
|---|---|
| `git-graph.combineLocalAndRemoteBranchLabels` | `referenceLabels.combineLocalAndRemoteBranchLabels` |
| `git-graph.commitDetailsViewFileTreeCompactFolders` | `commitDetailsView.fileView.fileTree.compactFolders` |
| `git-graph.commitDetailsViewLocation` | `commitDetailsView.location` |
| `git-graph.commitOrdering` | `repository.commits.order` |
| `git-graph.defaultFileViewType` | `commitDetailsView.fileView.type` |
| `git-graph.fetchAndPrune` | `repository.fetchAndPrune` |
| `git-graph.includeCommitsMentionedByReflogs` | `repository.includeCommitsMentionedByReflogs` |
| `git-graph.loadMoreCommitsAutomatically` | `repository.commits.loadMoreAutomatically` |
| `git-graph.muteCommitsThatAreNotAncestorsOfHead` | `repository.commits.mute.commitsThatAreNotAncestorsOfHead` |
| `git-graph.muteMergeCommits` | `repository.commits.mute.mergeCommits` |
| `git-graph.onlyFollowFirstParent` | `repository.onlyFollowFirstParent` |
| `git-graph.openDiffTabLocation` | `openNewTabEditorGroup` |
| `git-graph.openRepoToHead` | `repository.onLoad.scrollToHead` |
| `git-graph.referenceLabelAlignment` | `referenceLabels.alignment` |
| `git-graph.showCommitsOnlyReferencedByTags` | `repository.showCommitsOnlyReferencedByTags` |
| `git-graph.showSignatureStatus` | `repository.commits.showSignatureStatus` |
| `git-graph.showTags` | `repository.showTags` |
| `git-graph.showUntrackedFiles` | `repository.showUntrackedFiles` |
| `git-graph.useMailmap` | `repository.useMailmap` |

---

## Commands added upstream

At `4af8583` the extension contributed two commands: `git-graph.view` and
`git-graph.clearAvatarCache`. Upstream added eight more by `d7f43f4`, all in
the "Git Graph" category.

| Command | Title | Description |
|---|---|---|
| `git-graph.addGitRepository` | Add Git Repository... | Pick a folder and register it as a repository (#90) |
| `git-graph.removeGitRepository` | Remove Git Repository... | Unregister a repository from the extension (#146) |
| `git-graph.endAllWorkspaceCodeReviews` | End All Code Reviews in Workspace | Discard every stored code review state (#122) |
| `git-graph.endSpecificWorkspaceCodeReview` | End a specific Code Review in Workspace... | Quick-pick one review and end it (#253) |
| `git-graph.resumeWorkspaceCodeReview` | Resume a specific Code Review in Workspace... | Quick-pick a review and open the view on it (#231) |
| `git-graph.fetch` | Fetch from Remote(s) | Open the view and run fetch at once (#412) |
| `git-graph.version` | Get Version Information | Show extension, VS Code and git versions, copyable (#398) |
| `git-graph.openFile` | Open File | Open the working file from a diff that the extension opened. Shown in `editor/title` for `resourceScheme == git-graph` (#476) |

Related `contributes.menus` additions: `scm/title` entries for `git-graph.view`
gated on `git-graph.sourceCodeProviderIntegrationLocation` (#76), and
`editor/title` plus `commandPalette` entries for `git-graph.openFile` gated
on `isInDiffEditor && resourceScheme == git-graph && git-graph:codiconsSupported`
(#476). Upstream has no `contributes.keybindings`. The webview handles all
shortcuts itself.

---

## Re-implementation roadmap

Priorities:

- P0: foundations that everything else depends on.
- P1: high user value, widely used.
- P2: useful, but for a narrower audience.
- P3: optional or low value for this fork.

Inside each priority, the order is the suggested build order.

### P0 - foundations

#### 1. Modernization, build and test infrastructure

Reason: every later theme needs a current toolchain, a webview that passes
CSP, and a test suite that keeps regressions out while large features land.
The fork already targets VS Code `^1.74.0`, so the version bump is done. The
rest is open.

Covers:

- #191: `@types/vscode`.
- #305: `asWebviewUri` and `cspSource`, minimum VS Code version.
- #209: Node `fs` instead of the Electron variant.
- #130: `spawn` instead of `exec`.
- #135 and #165: git executable detection parity with the built-in Git extension.
- #392: `git.path` as an array.
- #83 and #221: Remote Development.
- #222: symlink resolution.
- #372: network drives.
- Jest unit tests, ESLint, GitHub Actions CI, TypeScript 4.x.
- Skip: the upstream install and update life-cycle event reporting.

#### 2. Logging

Reason: cheap, and it makes every later feature debuggable. An Output Channel
records git invocations and extension events.

Covers:

- #129: Output Channel logging.
- #494: argument normalization and command invocation logging.
- #426: error logging for external tools.
- Back-end to front-end message logging (1.31.0-beta.2).

#### 3. Data loading, refresh, and graph rendering core

Reason: the 1.16.0 graph rewrite and the 1.21.0 load and refresh overhaul
carry the later features (stashes, tooltips, drop, topological navigation,
auto-load). Build this before you add row types.

Covers:

- #183: graph construction and layout.
- #54 and #59: baseline, already in the fork.
- #81: many tags.
- #130: many branches.
- #168: stdout race.
- #241: auto-load more commits.
- #117 and #304: commit ordering.
- #126: detached HEAD with Show All.
- Event delegation and menus or dialogs that survive a refresh (1.21.0 internal).
- #452: `log.showSignature` override.
- #160: strip color codes.

#### 4. Settings infrastructure

Reason: the grouped setting names, per-repository overrides, boolean coercion
and the `contextMenuActionsVisibility` object cut across all themes. The
dialog-default settings all hang off this.

Covers:

- #361: grouped names with deprecated fallbacks.
- #198 and #517: context menu visibility.
- #145, #181, #213, #327, #331, #336: dialog defaults.
- #406 and #486: rebindable shortcuts.
- #416 and #150: `fileEncoding`, also at folder scope.
- #143: mailmap.
- #285: untracked files.
- #178, #216, #407, #429: show tag-only commits, tags, remote heads, stashes.
- Boolean coercion of settings (1.15.0 internal).

### P1 - core user value

#### 5. Git actions and dialogs

Reason: the largest single body of user-facing functionality. Most issues in
the gap are here, and every other theme reuses the dialog framework (#205).

Covers:

- #205: themed custom inputs.
- #73 and #279: Enter and IME submit.
- #303: dropdown scrollbars.
- #36: uncommitted changes actions.
- #63: squash merge.
- #64 and #115: delete remote branch.
- #34: rebase.
- #57 and #412: fetch.
- #93, #94, #159, #239, #385, #424, #507: push tag or branch, force, lease, multiple remotes, default remote, unsafe-tag warning.
- #98 and #322: pull or merge from a remote branch.
- #109: delete tag on remote.
- #119: check out on create.
- #131 and #297: checkout of a remote branch with a name conflict.
- #128 and #395: fetch into local branch, force.
- #161, #427, #547: delete branch on remotes, one-click force delete, old git compatibility.
- #186: push tag on add.
- #188 and #251: cherry pick no-commit, record origin.
- #174 and #365: drop commit.
- #233: always accept checkout.
- #248: merge no-commit.
- #255: latest tag hint.
- #390: existing branch or tag name conflict.
- #399: sign commits and tags.
- #419: name the current branch.
- #471: space substitution.
- #292: archive.
- #225: user details.
- #92: running-action indicator, scroll preservation.

#### 6. Commit Details View and file views

Reason: the second most used surface. Many small actions compound into a
large usability gain.

Covers:

- #29: compare commits.
- #74: dock.
- #151: resize.
- #202: file list.
- #337: compact folders.
- #108, #142, #286, #381, #457, #466, #476, #480, #516: per-file actions and context menu.
- #116, #386, #104, #316, #409, #364, #491, #227: message rendering (links, hashes, emoji, markdown, whitespace).
- #243: clickable parents.
- #269: dual dates, committer email.
- #240 and #498: signature status.
- #274: merge commit files.
- #62, #189, #192, #137: file name and path edge cases.
- #319: accessibility letters.
- #426: external diff tool.
- #277 and #85: editor group.
- #155: sub-repo click-through.
- #259: HEAD tooltip.

#### 7. Stash support

Reason: a top-requested feature (#48) that most alternatives offer. Depends
on the P0 graph core and the P1 dialog framework.

Covers: #48, #180, #204, #181, #208, #237, #266, #201, #429.

#### 8. Graph view presentation and filtering

Reason: how the graph looks and what it shows. Cheap wins once the core is
in place.

Covers:

- #71 and #78: label alignment, combined labels.
- #79: column visibility.
- #87: HEAD label emphasis.
- #100 and #139: muting.
- #156: vertex tooltip.
- #237: stash rendering.
- #393: uncommitted circle style.
- #77, #49, #175, #417: branch dropdown multi-select, globs, show-all toggle, context actions.
- #123: persist show-remote-branches.
- #318 and #341: branches shown on load.
- #190: hide remotes.
- #107: SVN branches.
- #89 and #287: reflogs, first-parent.
- #185: ISO dates.
- #197 and #232: narrow layouts.
- #363 and #389: high contrast, selection color.
- #219, #218, #283: scroll to HEAD, flash.
- #359: Up/Down scroll.

#### 9. Find widget

Reason: self-contained, high value, and depends only on the row model.

Covers:

- #31: find with case and regex modes.
- #402: open details while you step through matches.
- Find widget polish: Shift+Enter, icons, tooltips, narrow views.

#### 10. Repository management

Reason: multi-root workspaces and sub-repos are common. Without this the
extension misses repositories or shows duplicates.

Covers:

- #90, #146: add and remove commands.
- #158: workflow stability.
- #173: submodules.
- #177 and #60: path hints, tooltips.
- #91: follow the active editor.
- #76: SCM title button.
- #321 and #479: dropdown order.
- #357: custom name.
- #293: open terminal.
- #149: terminal shell.
- BufferedQueue for file system events (1.28.0 internal).

#### 11. Repository Settings widget

Reason: the home for per-repository settings that several themes above use
(remotes, issue linking, PR providers, initial branches).

Covers:

- #95: remotes CRUD.
- #154 and #356: fetch or prune a remote, prune tags dialog.
- #190: hide remote branches.
- #215: open extension settings.
- #216, #429, #89, #287: per-repo toggles.
- #318: initial branches.
- #357: custom name.
- #225: user details.
- #281 and #376: `git config` includes, no global file required.
- #414: export and import of repository settings.

#### 12. Keyboard shortcuts

Reason: small, but the rebindable layer (#406) must exist before the
shortcuts spread across widgets.

Covers: #73, #218, #201, #299, #383, #359, #283, #406, #486.

### P2 - useful, narrower audience

#### 13. Code review mode

Reason: a feature with persistent state and three commands. Depends on the
details view and file views.

Covers: #122, #231, #253, #482, the `endAllWorkspaceCodeReviews` command.

#### 14. Issue linking and pull request creation

Reason: integrations that teams like, but they require the settings widget
and careful URL handling.

Covers:

- #220, #223, #262, #404, #499: issue linking.
- #250 and `customPullRequestProviders`: PR creation.

#### 15. Avatars

Reason: the fork already fetches avatars. The remaining items are refinements.

Covers:

- #125: SSH remotes.
- #164: high DPI.
- #369: case-insensitive Gravatar.
- Result message for "Clear Avatar Cache".

#### 16. Askpass and credentials

Reason: needed for fetch and push over HTTPS without a credential helper, but
many users already have one. It spawns helper scripts and opens an IPC
channel, so it deserves its own security review.

Covers: #114.

#### 17. Accessibility and theming

Reason: important for a subset of users. Mostly CSS and small renderer
changes once the custom dialog controls exist.

Covers: #319, #363, #389, #205.

#### 18. Utility commands

Reason: low effort, modest value.

Covers:

- #398: version information.
- #412: fetch command.
- #476: open file from the diff title.

### P3 - optional for this fork

#### 19. VS Code in the browser

Reason: requires the removal of Node-only paths from the webview and the
extension host. Useful only for a fork that targets vscode.dev or Codespaces.

Covers: #271.

#### 20. Emoji shortcode catalog maintenance

Reason: keep gitmoji mappings current. Trivial and ongoing.

Covers: #104, #316, #409.

#### 21. Install and update life-cycle reporting

Reason: upstream used it to phase in API features. This fork does not need
to report installs anywhere. Not planned.

---

## Phase 1.5: performance

This table lists the upstream performance changes. The sources are changelog
lines and commit subjects that mention performance, speed, load time or
rendering. The fork point already includes #54 (graph rendering algorithm)
and #59 (faster open, load and details view) from 1.4.6.

| Release | Change | Issue / source |
|---|---|---|
| 1.6.0 | `retainContextWhenHidden` keeps the webview alive for instant tab restore | #30 |
| 1.6.0 | Handle repositories with a very large number of tags and refs | #81 |
| 1.8.0 | `retainContextWhenHidden` on by default. Keep scroll position across actions | #92 |
| 1.9.0 | Front-end code and performance improvements | commit `6488306` |
| 1.11.0 | Replace `child_process.exec` with `spawn` to avoid buffer limits | commit `5b3f0a3` |
| 1.12.0 | Support repositories with 1000+ branches. Last `exec` calls removed | #130 |
| 1.14.0 | Fix the race that truncated stdout of some git commands | #168 |
| 1.15.0 | Graph renderer refactor with a performance improvement | commit `19c50e7` |
| 1.16.0 | Graph construction, representation and layout rewrite | #183 |
| 1.17.0 | Code, performance and UI improvements (with the `@types/vscode` move) | #191 |
| 1.21.0 | Overhaul of data loading and refresh for stability and UX | commit `f9550f1` |
| 1.21.0 | Event delegation to speed up table load and refresh. Faster rendering and event handling | commit `f1e9287` |
| 1.21.0 | Auto-load more commits on scroll instead of a button | #241 |
| 1.22.0 | Faster count of uncommitted changes | commit `afdb929` |
| 1.23.0 | `showUntrackedFiles` setting to cut load time on large repositories | #285 |
| 1.26.0 | Mapped network drive handling on Windows (git >= 2.25) | #372 |
| 1.28.0 | BufferedQueue for repository file system events | commit `6f38c67` |
| 1.30.0 | Inline code rendering normalized so rows keep a constant height | #491 |
| 1.31.0-beta.2 | Faster timer-based unit tests | commit `5681ac7` |

Suggested order for the fork:

1. Spawn-based git invocation and the stdout race fix (correctness).
2. The graph core rewrite (#183).
3. Event delegation and auto-load (#241).
4. The opt-in load-time settings (#285, `retainContextWhenHidden`).
