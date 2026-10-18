# Git Graph Community for Visual Studio Code

View a Git Graph of your repository, and perform Git actions from the graph.

This is a community-maintained fork of [Git Graph](https://github.com/mhutchie/vscode-git-graph) by Michael Hutchison. It continues from version 1.4.6 (upstream commit `4af8583`), the last version released under the MIT License, and stays MIT licensed.

![Recording of Git Graph](https://github.com/erancihan/vscode-git-graph/raw/master/resources/demo.gif)

## Why this fork exists

The original extension stopped receiving updates in 2021. From May 2019 on, its license does not allow anyone to publish or distribute derivative works, so later upstream code cannot be reused. This fork takes the last MIT version, modernizes the toolchain, and re-implements later features from their descriptions. The list of features that still need to be re-implemented is in [docs/UPSTREAM_GAP.md](docs/UPSTREAM_GAP.md). Open upstream pull requests under review are listed in [docs/UPSTREAM_PRS.md](docs/UPSTREAM_PRS.md).

If you have the original `mhutchie.git-graph` extension installed, uninstall or disable it first. Both extensions register the same commands and settings.

## Features

* Git Graph View:
    * Display:
        * Local and remote branches
        * Local refs: heads, tags, and remotes
        * Local uncommitted changes
        * Stashes
    * View commit details and file changes by clicking on a commit
        * Open the Visual Studio Code diff of a file change by clicking on it in the commit details view
        * Right-click a file for more: view the file at that revision, diff with the working file, open the file, copy its path
        * Switch between the file tree and a flat file list
        * Compare two commits: Ctrl/Cmd+click a second commit (or the uncommitted changes) while the details are open
    * Perform Git actions by right clicking on a commit, branch, tag, stash, or the uncommitted changes:
        * Create, checkout, rename, delete, merge, rebase on, and push branches
        * Delete remote branches, fetch a remote branch into a local branch, pull a remote branch into the current branch
        * Add, delete, and push tags
        * Checkout, cherry pick, merge, rebase on, revert, and drop commits
        * Reset the current branch to a commit; reset or clean the uncommitted changes
        * Stash the uncommitted changes; apply, pop, drop, or branch from a stash
        * Copy commit hashes (full or short), tag names, branch names, and stash names to the clipboard
    * Show only the commits of one branch, of the checked-out commit (HEAD), or of everything
    * Fetch from all remotes with the Fetch button
    * Find commits with Ctrl/Cmd+F: match case and regular expression modes, step through the matches
    * Show or hide the Date, Author and Commit columns (right-click a column header), mute merge commits or commits outside the ancestry of HEAD
    * Keyboard shortcuts: Ctrl/Cmd+R refresh, Ctrl/Cmd+H scroll to HEAD, Ctrl/Cmd+S next stash
* Configurable settings (graph style, branch colours, and more)
* "Git Graph: View Git Graph" command in the Command Palette
* "Git Graph" button in the Status Bar and in the title bar of the Source Control view
* Submodules are shown as repositories of their own; repositories can be added and removed with commands

## Extension Settings

This extension contributes the following settings:

* `git-graph.commitDetailsView.autoCenter`: Automatically center the commit details view when it is opened.
* `git-graph.commitDetailsView.fileView.fileTree.compactFolders`: Show a folder that only contains one folder on one line. Default: true.
* `git-graph.commitDetailsView.fileView.type`: Default file view in the commit details: `File Tree` or `File List`. Default: `File Tree`.
* `git-graph.contextMenuActionsVisibility`: Hide individual context menu actions, for example `{"commit": {"reset": false}}`. Menus: `branch`, `commit`, `remoteBranch`, `tag`.
* `git-graph.date.format`: Specifies the date format used in the date column of the graph.
* `git-graph.date.type`: Specifies whether the author date or the commit date is displayed.
* `git-graph.defaultColumnVisibility`: Default visibility of the Date, Author and Commit columns, for example `{"Date": true, "Author": false, "Commit": true}`. Right-click a column header to change it per repository.
* `git-graph.dialog.addTag.type`: Default tag type in the "Add Tag" dialog: `Annotated` or `Lightweight`.
* `git-graph.dialog.applyStash.reinstateIndex`: Default state of "Reinstate Index" in the "Apply Stash" dialog. Default: false.
* `git-graph.dialog.cherryPick.noCommit`: Default state of "No Commit" in the "Cherry Pick" dialog. Default: false.
* `git-graph.dialog.cherryPick.recordOrigin`: Default state of "Record Origin" in the "Cherry Pick" dialog. Default: false.
* `git-graph.dialog.createBranch.checkOut`: Default state of "Check out" in the "Create Branch" dialog. Default: false.
* `git-graph.dialog.deleteBranch.forceDelete`: Default state of "Force Delete" in the "Delete Branch" dialog. Default: false.
* `git-graph.dialog.fetchIntoLocalBranch.forceFetch`: Default state of "Force Fetch" in the "Fetch into local branch" dialog. Default: false.
* `git-graph.dialog.general.referenceInputSpaceSubstitution`: Replace spaces typed into branch and tag names with `Hyphen` or `Underscore`. Default: `None`.
* `git-graph.dialog.merge.noCommit`: Default state of "No Commit" in the merge dialogs. Default: false.
* `git-graph.dialog.merge.noFastForward`: Default state of "Create a new commit even if fast-forward is possible" in the merge dialogs. Default: true.
* `git-graph.dialog.merge.squashCommits`: Default state of "Squash Commits" in the merge dialogs. Default: false.
* `git-graph.dialog.merge.squashMessageFormat`: Message of the squash commit: `Default` ("Merge branch 'name'") or `Git SQUASH_MSG`. Default: `Default`.
* `git-graph.dialog.popStash.reinstateIndex`: Default state of "Reinstate Index" in the "Pop Stash" dialog. Default: false.
* `git-graph.dialog.pullBranch.noFastForward`: Default state of "Create a new commit even if fast-forward is possible" in the "Pull into current branch" dialog. Default: false.
* `git-graph.dialog.pullBranch.squashCommits`: Default state of "Squash Commits" in the "Pull into current branch" dialog. Default: false.
* `git-graph.dialog.rebase.ignoreDate`: Default state of "Ignore Date" in the rebase dialogs. Default: true.
* `git-graph.dialog.resetCurrentBranchToCommit.mode`: Default reset mode: `Soft`, `Mixed` or `Hard`. Default: `Mixed`.
* `git-graph.dialog.resetUncommittedChanges.mode`: Default reset mode in the "Reset uncommitted changes" dialog: `Mixed` or `Hard`. Default: `Mixed`.
* `git-graph.dialog.stashUncommittedChanges.includeUntracked`: Default state of "Include Untracked" in the "Stash uncommitted changes" dialog. Default: false.
* `git-graph.graph.colours`: Specifies the colours used on the graph.
* `git-graph.graph.style`: Specifies the style of the graph.
* `git-graph.keyboardShortcut.find`: Letter of the Ctrl/Cmd shortcut that opens the find widget. Default: `f`.
* `git-graph.keyboardShortcut.refresh`: Letter of the Ctrl/Cmd shortcut that refreshes the view. Default: `r`.
* `git-graph.keyboardShortcut.scrollToHead`: Letter of the Ctrl/Cmd shortcut that scrolls to the checked-out commit. Default: `h`.
* `git-graph.keyboardShortcut.scrollToStash`: Letter of the Ctrl/Cmd shortcut that scrolls to the next stash (Shift for the previous). Default: `s`.
* `git-graph.openToTheRepoOfTheActiveTextEditorDocument`: Open the view on the repository of the active editor's document. Default: false.
* `git-graph.maxDepthOfRepoSearch`: Specifies the maximum depth of subfolders to search when discovering repositories in the workspace. Default: 0.
* `git-graph.repository.fetchAndPrune`: Prune remote-tracking references when the Fetch button is pressed. Default: false.
* `git-graph.repository.fetchAndPruneTags`: Also prune local tags when the Fetch button is pressed (git 2.17 or later). Default: false.
* `git-graph.repository.commits.fetchAvatars`: Fetch avatars of commit authors and committers. Default: false.
* `git-graph.repository.commits.initialLoad`: Specifies the number of commits to load initially.
* `git-graph.repository.commits.loadMore`: Specifies the number of commits to load when the "Load More Commits" button is pressed.
* `git-graph.repository.commits.loadMoreAutomatically`: Load more commits automatically when the view is scrolled to the bottom. Default: false.
* `git-graph.repository.commits.mute.commitsThatAreNotAncestorsOfHead`: Mute commits that are not ancestors of the checked-out commit. Default: false.
* `git-graph.repository.commits.mute.mergeCommits`: Mute merge commits. Default: false.
* `git-graph.repository.commits.order`: Order of commits on the graph: `date`, `author-date` or `topo`. Default: `date`.
* `git-graph.repository.includeCommitsMentionedByReflogs`: Include commits only mentioned by reflogs when "Show All" is selected. Default: false.
* `git-graph.repository.onLoad.scrollToHead`: Scroll to the checked-out commit when a repository is loaded. Default: false.
* `git-graph.repository.onLoad.showCheckedOutBranch`: Show only the checked-out branch when Git Graph is opened. Default: false.
* `git-graph.repository.sign.commits`: Sign the commits Git Graph creates with the signing key of your git configuration. Default: false.
* `git-graph.repository.sign.tags`: Sign the annotated tags Git Graph creates. Default: false.
* `git-graph.repository.onlyFollowFirstParent`: Load commits with `--first-parent`. Default: false.
* `git-graph.repository.showCommitsOnlyReferencedByTags`: Show commits that are only reachable from tags when "Show All" is selected. Default: true.
* `git-graph.repository.showRemoteBranches`: Default state of the "Show Remote Branches" checkbox. Default: true.
* `git-graph.repository.showRemoteHeads`: Show remote HEAD references such as `origin/HEAD`. Default: true.
* `git-graph.repository.showStashes`: Show stashes on the graph. Default: true.
* `git-graph.repository.showTags`: Show tags on the graph. Default: true.
* `git-graph.repository.showUncommittedChanges`: Show uncommitted changes. Set to false to decrease load time on large repositories.
* `git-graph.repository.showUntrackedFiles`: Count untracked files in the "Uncommitted Changes" row. Default: true.
* `git-graph.repository.useMailmap`: Apply the repository's `.mailmap` to author and committer identities. Default: false.
* `git-graph.repositoryDropdownOrder`: Order of the "Repo" dropdown: `Full Path`, `Name` or `Workspace Full Path`. Default: `Workspace Full Path`.
* `git-graph.retainContextWhenHidden`: Keep the view alive while its tab is hidden so it restores instantly. Default: true.
* `git-graph.sourceCodeProviderIntegrationLocation`: Where "View Git Graph" appears in the Source Control view: `Inline` (title bar button) or `More Actions`. Default: `Inline`.
* `git-graph.showStatusBarItem`: Show a Status Bar item that opens Git Graph when clicked.
* `git-graph.tabIconColourTheme`: Specifies the colour theme of the icon displayed on the Git Graph tab.

The flat setting names from version 1.x (for example `git-graph.dateFormat`) are deprecated. They are still read when the grouped name is not set, so existing configurations keep working.

This extension reads the following setting:

* `git.path`: Path of the git executable, or an array of candidate paths. When it is not set, or none of the paths work, the extension looks for git on PATH and in the usual install locations (Git for Windows, Homebrew, Xcode).

## Extension Commands

* `git-graph.view`: Git Graph: View Git Graph
* `git-graph.addGitRepository`: Git Graph: Add Git Repository... (a repository outside the workspace folders, or one that was removed)
* `git-graph.removeGitRepository`: Git Graph: Remove Git Repository...
* `git-graph.clearAvatarCache`: Git Graph: Clear Avatar Cache

## Install

* Visual Studio Marketplace: `erancihan.vscode-git-graph`
* Open VSX: `erancihan.vscode-git-graph`
* Manual: download the `.vsix` file from the [releases page](https://github.com/erancihan/vscode-git-graph/releases) and run `code --install-extension <file>.vsix`.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## Roadmap

See [ROADMAP.md](ROADMAP.md) for milestones and the plan to reach parity with Git Graph 1.30 and with the wider field. A feature comparison with other Git graph extensions is in [docs/COMPETITORS.md](docs/COMPETITORS.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every contribution must follow the license rule described there.

## License

MIT. See [LICENSE](LICENSE). The original Git Graph up to version 1.4.6 is copyright Michael Hutchison.
