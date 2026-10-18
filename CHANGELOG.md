# Change Log

## Unreleased

* The rebase dialogs have a "Launch Interactive Rebase in new Terminal" option. It opens an integrated terminal in the repository and runs `git rebase --interactive` there, so the todo list can be edited. New settings `git-graph.dialog.rebase.launchInteractiveRebase` and `git-graph.integratedTerminalShell`.
* Security: the command typed into the terminal accepts only letters, digits and `_ . / @ + -` in the rebase target. Other reference names are refused with a message instead of being passed to the shell.

## 2.2.0 - 2026-10-18

Milestone "2.2 Core actions", first release. Everything below was re-implemented from feature descriptions; no code was taken from upstream versions after 1.4.6 or from other extensions.

* Remote actions: a Fetch button (all remotes, with the `git-graph.repository.fetchAndPrune` and `fetchAndPruneTags` options), "Push Branch" with set-upstream and force / force-with-lease modes, "Pull into current branch" with no-fast-forward and squash options, "Delete Remote Branch", and "Fetch into local branch" (update a local branch that is not checked out).
* "Rebase current branch on this branch" and "Rebase current branch on this Commit", with an "Ignore Date" option.
* New `git-graph.dialog.*` defaults for the new dialogs (`fetchIntoLocalBranch.forceFetch`, `pullBranch.noFastForward`, `pullBranch.squashCommits`, `rebase.ignoreDate`) and new keys in `git-graph.contextMenuActionsVisibility` (`branch.rebase`, `branch.push`, `commit.rebase`, `remoteBranch.delete`, `remoteBranch.fetch`, `remoteBranch.pull`).
* The "action running" dialog closes by itself when the action succeeds.
* "Create Branch" has a "Check out" option. The merge dialogs have "Squash Commits" and "No Commit" options (`git-graph.dialog.merge.squashMessageFormat` picks the squash commit message). "Cherry Pick" has "Record Origin" and "No Commit" options.
* New "Drop Commit" action on non-merge commits, and a context menu on the "Uncommitted Changes" row with "Reset uncommitted changes" (mixed or hard) and "Clean untracked files" (optionally directories).
* Fixed: commit messages shown in the parent selector of the cherry pick and revert dialogs were inserted as HTML. They are now escaped.
* Repositories: "Git Graph: Add Git Repository..." adds a repository from any folder (kept across sessions, also outside the workspace), "Git Graph: Remove Git Repository..." removes one and keeps it out of future discovery. Submodules declared in `.gitmodules` are added as repositories. New settings `git-graph.repositoryDropdownOrder`, `git-graph.openToTheRepoOfTheActiveTextEditorDocument`, and `git-graph.sourceCodeProviderIntegrationLocation` for the new "View Git Graph" button in the Source Control view.
* Security: submodule paths are taken from the index (gitlink entries) and must stay inside the repository; a crafted `.gitmodules` cannot register a folder outside the repository. Every git command runs with `safe.bareRepository=explicit`, so a bare repository embedded in a checkout is not picked up as the repository.
* The Branch dropdown supports selecting more than one branch: Ctrl/Cmd+click adds an entry to the selection. Named glob patterns from `git-graph.customBranchGlobPatterns` appear as entries, for example all `feature/*` branches.
* The Branch dropdown has a "HEAD (checked-out commit)" entry that shows the history of the checked-out commit, also when HEAD is detached.
* The Commit Details View lists the branches and tags that point at the commit.
* "Copy Short Commit Hash to Clipboard" copies the 8-character hash.
* Compare commits: with the Commit Details View open, Ctrl/Cmd+click another commit, or the "Uncommitted Changes" row, to see the files that differ between the two revisions. Clicking a file opens the diff between them. Ctrl/Cmd+click the compared commit again to return to the single commit.
* Commit Details View: right-click a file for "View Diff", "View File at this Revision", "View Diff with Working File", "Open File", and copying the absolute or relative path. The changed files can be shown as a tree or as a flat list (buttons above the files, default from `git-graph.commitDetailsView.fileView.type`). Folders that only contain one folder are shown on one line (`git-graph.commitDetailsView.fileView.fileTree.compactFolders`).
* Fixed: file and folder names in the commit details were inserted as HTML. They are now escaped.
* Fixed: a failure to open a diff was reported as success.
* Columns: the Date, Author and Commit columns can be hidden. The default comes from `git-graph.defaultColumnVisibility`; right-click a column header to change it for one repository. Column resizing works with any set of visible columns.
* Muting: `git-graph.repository.commits.mute.mergeCommits` and `git-graph.repository.commits.mute.commitsThatAreNotAncestorsOfHead` show those rows with a muted colour.
* Loading options: `git-graph.repository.onlyFollowFirstParent` (`--first-parent`), `git-graph.repository.includeCommitsMentionedByReflogs` (`--reflog` with "Show All"), `git-graph.repository.onLoad.scrollToHead`.
* Keyboard shortcuts: Ctrl/Cmd+R refreshes, Ctrl/Cmd+H scrolls to the checked-out commit, Ctrl/Cmd+S scrolls to the next stash (Shift for the previous one). The letters are configurable with `git-graph.keyboardShortcut.*`.
* Find widget: press Ctrl+F (Cmd+F on macOS) in the view to search commit messages, authors, email addresses, hashes and reference names. Match Case and Regular Expression toggles, Enter and Shift+Enter step through the matches, and when the commit details view is open it follows the current match. The letter of the shortcut is configurable with `git-graph.keyboardShortcut.find`.
* Stashes are shown on the graph as rows above the commit they were created from (`git-graph.repository.showStashes`). A stash row has Apply, Pop, Drop, Create Branch from Stash, and copy actions. The "Uncommitted Changes" row has "Stash uncommitted changes" with a message and an "Include Untracked" option. New `git-graph.dialog.applyStash.reinstateIndex`, `dialog.popStash.reinstateIndex` and `dialog.stashUncommittedChanges.includeUntracked` defaults, and a `stash` menu in `git-graph.contextMenuActionsVisibility`.
* New settings `git-graph.repository.sign.commits` and `git-graph.repository.sign.tags`: sign the commits and annotated tags that Git Graph creates.

## 2.1.0 - 2026-10-18

Milestone "2.1 Foundations". Everything below was re-implemented from feature descriptions; no code was taken from upstream versions after 1.4.6 or from other extensions.

* New "Git Graph" Output Channel (View > Output). It records every git command the extension runs, extension events, and errors from the avatar services (GitHub, GitLab, Gravatar). Open it when something does not load.
* All git commands are now started with `spawn` and an argument array instead of a shell command line. Branch names, tag names and messages that contain quotes or spaces work, and the extension no longer depends on a shell.
* Git output is collected as bytes and decoded after the process closes, so multi-byte characters split across chunks stay intact.
* Every git command runs with `color.ui=false` and `log.showSignature=false`, so a user configuration with coloured output or signature display no longer breaks parsing.
* The `git.path` setting of the built-in Git extension can be an array of candidate paths. The first candidate that runs is used. When nothing is configured, or no configured path works, git is searched on PATH and then in the usual install locations (Git for Windows, Homebrew, Xcode). The chosen executable and its version are written to the Output Channel.
* New setting `git-graph.retainContextWhenHidden` (default true): keep the view alive while its tab is hidden so switching back is instant.
* A git executable that cannot be started is reported in the Output Channel instead of failing silently.
* Reference names that start with `-` and commit hashes that are not hexadecimal are refused before they reach git, so a hostile repository cannot turn a branch name into a git option.
* Settings use grouped names, for example `git-graph.date.format` and `git-graph.repository.commits.initialLoad`. The flat names from version 1.x are marked deprecated in the Settings editor but are still read when the grouped name is not set. Boolean and number settings accept string values from hand-edited `settings.json` files.
* New setting `git-graph.repository.commits.order`: `date` (default), `author-date` or `topo`.
* New setting `git-graph.repository.commits.loadMoreAutomatically`: load the next page of commits when the view is scrolled to the bottom.
* New settings `git-graph.repository.showRemoteBranches` (default state of the checkbox), `git-graph.repository.showTags`, `git-graph.repository.showRemoteHeads` and `git-graph.repository.showCommitsOnlyReferencedByTags`.
* New settings `git-graph.repository.useMailmap` (apply `.mailmap` to names and email addresses) and `git-graph.repository.showUntrackedFiles` (leave untracked files out of the "Uncommitted Changes" count).
* New `git-graph.dialog.*` settings for the default values of the action dialogs: `addTag.type`, `deleteBranch.forceDelete`, `merge.noFastForward`, `resetCurrentBranchToCommit.mode` and `general.referenceInputSpaceSubstitution` (replace spaces typed into branch and tag names with a hyphen or underscore).
* New setting `git-graph.contextMenuActionsVisibility`: hide individual actions from the commit, branch, remote branch and tag context menus.
* Fixed: with a detached HEAD and "Show All" selected, the checked-out commit was missing from the graph when no branch or tag pointed at it.
* Performance: rendering the graph no longer takes quadratic time in the number of rows a branch line spans. A synthetic history of 20,000 commits on 200 interleaved branches renders in about 0.1 seconds instead of 17 seconds, and the layout pass is about 2.5 times faster with few branches. Commit rows and reference labels use one set of listeners on the table instead of one per row.
* The webview loads its script and stylesheets through `asWebviewUri` and restricts scripts to the page nonce. The deprecated `vscode-resource:` scheme is gone, which keeps the view working in Remote Development and in current Visual Studio Code versions.

## 2.0.2 - 2026-10-15

* The display name is now "Git Graph Community". The Visual Studio Marketplace requires display names to be unique, and "Git Graph" belongs to the original extension. Nothing else changed.

## 2.0.1 - 2026-10-15

* The package name is now `vscode-git-graph`, so the extension ID is `erancihan.vscode-git-graph`. The Visual Studio Marketplace requires package names to be unique across all publishers, and `git-graph` is taken by the original extension. Settings and commands keep the `git-graph.` prefix. This is the first version published to the Marketplace. Version 2.0.0 exists only as a GitHub release.

## 2.0.0 - 2026-10-15

First release of the community-maintained MIT fork. It continues from Git Graph 1.4.6 by mhutchie, the last MIT-licensed version.

Changes compared to 1.4.6:
* New publisher `erancihan` and extension ID `erancihan.vscode-git-graph`. Settings and commands keep the `git-graph.` prefix.
* Requires Visual Studio Code 1.74 or later. Activates after startup instead of on every activation event.
* Toolchain update: TypeScript 5, `@types/vscode`, ESLint 10 with typescript-eslint, Node.js 20. TSLint and the old `vscode` test module are removed.
* GitHub Actions: CI builds a `.vsix` on every push and pull request. Pushing a `v*` tag creates a GitHub release and publishes to the Visual Studio Marketplace and Open VSX.
* Fixed: avatar cache entries were always overwritten because of a wrong type check in the avatar manager.
* Fixed: the commit details file tree failed when a folder was named like an inherited object member, for example `constructor` (reported upstream as #637).
* Line endings normalized to LF.

See `docs/UPSTREAM_GAP.md` for features that exist in later upstream versions and the plan to re-implement them.


## 1.4.6 - 2019-04-30
* #33 Support for git repositories in subfolders. New setting `git-graph.maxDepthOfRepoSearch` specifies the maximum depth of subfolders to search (default: 0).
* #50 Branch and repo dropdowns now have a filter to make it faster to find the desired item.
* #52 Copy branch and tag names to the clipboard.
* #53 Flattened the control bar and column header elements, to better suit the majority of Visual Studio Code Themes.
* #54 Graph rendering algorithm changes: performance improvements, and better layout of intermediate branch merges.
* #55 Robustness improvements of the avatar caching mechanism.
* #58 Removed the checkout and delete actions from the context menu of the checked out branch.
* #59 Various performance improvements for: opening Git Graph, loading commits, and opening the commit details view.

## 1.4.5 - 2019-04-15
* #26 Fetch and show commit author / committer avatars from GitHub, GitLab & Gravatar. If you'd like to use this feature, you must enable the setting `git-graph.fetchAvatars`. Thanks @meierw for helping with the development of this!
* #37 Columns can be resized by dragging the dividers in the table header.
* #43 Add more emphasis to the head commit.
* #44 Improved the documentation and descriptions of extension settings.
* #45 Include commits from heads that are only referenced by tags.
* #46 Fixed graph node misalignment when Visual Studio Code is zoomed.
* #51 Observe Visual Studio Code theme changes while Git Graph is open, now required due to a change in Visual Studio Code 1.33.0.

## 1.4.4 - 2019-04-01
* #27 Add lightweight or annotated tags. Add message (optional) to annotated tags.
* #35 Merge a specific commit from the commit context menu.
* #38 Push a tag to origin from the tag context menu.
* #39 Checkout a branch by double clicking on the branch label.
* #40 Reworded context menu actions. Use ellipses to differentiate non-immediate actions. Added support for dividers in the context menus to better segment actions.
* #41 Load the last viewed repo when opening Git Graph in a multi-root workspace.
* #42 New setting `git-graph.dateType` to specify the date type to be displayed, either the author or commit date.

## 1.4.3 - 2019-03-17
* #17 Automatic refresh when repo changes while Git Graph is visible.
* #32 Checkout a specific commit from the commit context menu.
* #20 Hide the "Git Graph" status bar item when the workspace has no Git repository.
* #28 Fixed the text colour used for dropdowns and dialogs, to support use with other VSCode colour themes.
* Added the Git Graph icon to the tab when Git Graph is opened. By default the icon is coloured, but it can be set to greyscale with the new configuration setting `git-graph.tabIconColourTheme`.

## 1.4.2 - 2019-03-10
* #22 New setting to show the current branch by default when Git Graph is opened, instead of showing all branches. By default `git-graph.showCurrentBranchByDefault` is false.
* #24 Display all lines of the commit body in the commit details view. Thanks @ShoshinNikita!

## 1.4.1 - 2019-03-09
* #13 Support for multiple Git repositories in multi-root workspaces.
* #8 Improved control bar style, for improved support of different colour themes.
* #23 Changed "Reverse this Commit" to "Revert this Commit", to match the corresponding Git command. Thanks @Larry850806!
* Several minor consistency improvements.

## 1.4.0 - 2019-02-28
* #12 Revert, cherry-pick & merge git commands are now available from the commit and branch context menus.
* #7 Added a setting to enable / disable automatic centering of the commit details view.
* #11 Context menu closes on the next mouse interaction, instead of when the mouse leaves the context menu.
* #15 Support for portable git installations.
* #18 Fixed handling of detached HEAD's.

## 1.3.3 - 2019-02-22
* #3 & #9: Fixes an issue preventing the graph loading for a few git repositories.
* #10: Fixes an issue where lines extending past the rightmost node of the graph would be cropped.
* Press escape to close any open Git Graph dialog.
* #6: The command title in the Command Palette is changed to "Git Graph: View Git Graph (git log)".
* Refined styling of the commit details view.

## 1.3.2 - 2019-02-18
* Fixes an issue when viewing some large graphs of more than 500 commits.
* Significantly reduced package size.

## 1.3.1 - 2019-02-17
* View the Visual Studio Code Diff of a file change in a commit, by clicking on the file in the commit details view.
* All git commands are run asynchronously to improve responsiveness.

## 1.3.0 - 2019-02-16
* Commit details view (click on a commit to open it). This shows the full commit details, and a tree view of all file changes in the commit.
* Support for git reset hard, mixed & soft.
* Add the branch colour to ref labels to make them easier to read.

## 1.2.0 - 2019-02-12
* Graph generation improvements, making complex graphs easier to read
* Graph rendering performance improvements
* Improved graph styling

## 1.1.0 - 2019-02-11
* Perform Git actions directly from Git Graph by right clicking on a commit / branch / tag:
    * Create, Checkout, Rename & Delete Branches
    * Add & Delete Tags
    * Copy Commit Hash to Clipboard
* Graph generation improvements

## 1.0.1 - 2019-02-10
* Detect & display lightweight tags

## 1.0.0 - 2019-02-10
* Initial release
* Git Graph Visualisation
    * Select from Local & Remote Branches
    * Display Heads, Tags & Remotes
    * Configuration Settings:
        * git-graph.graphColours - Specifies the colours used on the graph.
        * git-graph.graphStyle - Specifies the style of the graph.
        * git-graph.dateFormat - Specifies the number of commits to initially load.
        * git-graph.initialLoadCommits - Specifies the number of commits to initially load.
        * git-graph.loadMoreCommits - Specifies the number of commits to load when the "Load More Commits" button is pressed (only shown when more commits are available).
        * git-graph.showStatusBarItem - Show a Status Bar item which opens Git Graph when clicked.
        * git-graph.showUncommittedChanges - Show uncommitted changes (set to false to decrease load time on large repositories).
* Shortcut Button in the Status Bar