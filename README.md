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
    * View commit details and file changes by clicking on a commit
        * Open the Visual Studio Code diff of a file change by clicking on it in the commit details view
    * Perform Git actions by right clicking on a commit, branch, or tag:
        * Create, checkout, rename, delete, and merge branches
        * Add, delete, and push tags
        * Checkout, cherry pick, merge, and revert commits
        * Reset the current branch to a commit
        * Copy commit hashes, tag names, and branch names to the clipboard
* Configurable settings (graph style, branch colours, and more)
* "Git Graph: View Git Graph" command in the Command Palette
* "Git Graph" button in the Status Bar

## Extension Settings

This extension contributes the following settings:

* `git-graph.commitDetailsView.autoCenter`: Automatically center the commit details view when it is opened.
* `git-graph.contextMenuActionsVisibility`: Hide individual context menu actions, for example `{"commit": {"reset": false}}`. Menus: `branch`, `commit`, `remoteBranch`, `tag`.
* `git-graph.date.format`: Specifies the date format used in the date column of the graph.
* `git-graph.date.type`: Specifies whether the author date or the commit date is displayed.
* `git-graph.dialog.addTag.type`: Default tag type in the "Add Tag" dialog: `Annotated` or `Lightweight`.
* `git-graph.dialog.deleteBranch.forceDelete`: Default state of "Force Delete" in the "Delete Branch" dialog. Default: false.
* `git-graph.dialog.general.referenceInputSpaceSubstitution`: Replace spaces typed into branch and tag names with `Hyphen` or `Underscore`. Default: `None`.
* `git-graph.dialog.merge.noFastForward`: Default state of "Create a new commit even if fast-forward is possible" in the merge dialogs. Default: true.
* `git-graph.dialog.resetCurrentBranchToCommit.mode`: Default reset mode: `Soft`, `Mixed` or `Hard`. Default: `Mixed`.
* `git-graph.graph.colours`: Specifies the colours used on the graph.
* `git-graph.graph.style`: Specifies the style of the graph.
* `git-graph.maxDepthOfRepoSearch`: Specifies the maximum depth of subfolders to search when discovering repositories in the workspace. Default: 0.
* `git-graph.repository.commits.fetchAvatars`: Fetch avatars of commit authors and committers. Default: false.
* `git-graph.repository.commits.initialLoad`: Specifies the number of commits to load initially.
* `git-graph.repository.commits.loadMore`: Specifies the number of commits to load when the "Load More Commits" button is pressed.
* `git-graph.repository.commits.loadMoreAutomatically`: Load more commits automatically when the view is scrolled to the bottom. Default: false.
* `git-graph.repository.commits.order`: Order of commits on the graph: `date`, `author-date` or `topo`. Default: `date`.
* `git-graph.repository.onLoad.showCheckedOutBranch`: Show only the checked-out branch when Git Graph is opened. Default: false.
* `git-graph.repository.showCommitsOnlyReferencedByTags`: Show commits that are only reachable from tags when "Show All" is selected. Default: true.
* `git-graph.repository.showRemoteBranches`: Default state of the "Show Remote Branches" checkbox. Default: true.
* `git-graph.repository.showRemoteHeads`: Show remote HEAD references such as `origin/HEAD`. Default: true.
* `git-graph.repository.showTags`: Show tags on the graph. Default: true.
* `git-graph.repository.showUncommittedChanges`: Show uncommitted changes. Set to false to decrease load time on large repositories.
* `git-graph.repository.showUntrackedFiles`: Count untracked files in the "Uncommitted Changes" row. Default: true.
* `git-graph.repository.useMailmap`: Apply the repository's `.mailmap` to author and committer identities. Default: false.
* `git-graph.retainContextWhenHidden`: Keep the view alive while its tab is hidden so it restores instantly. Default: true.
* `git-graph.showStatusBarItem`: Show a Status Bar item that opens Git Graph when clicked.
* `git-graph.tabIconColourTheme`: Specifies the colour theme of the icon displayed on the Git Graph tab.

The flat setting names from version 1.x (for example `git-graph.dateFormat`) are deprecated. They are still read when the grouped name is not set, so existing configurations keep working.

This extension reads the following setting:

* `git.path`: Path of the git executable, or an array of candidate paths. When it is not set, or none of the paths work, the extension looks for git on PATH and in the usual install locations (Git for Windows, Homebrew, Xcode).

## Extension Commands

* `git-graph.view`: Git Graph: View Git Graph
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
