# Git Graph (MIT fork) for Visual Studio Code

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

* `git-graph.autoCenterCommitDetailsView`: Automatically center the commit details view when it is opened.
* `git-graph.dateFormat`: Specifies the date format used in the date column of the graph.
* `git-graph.dateType`: Specifies whether the author date or the commit date is displayed.
* `git-graph.fetchAvatars`: Fetch avatars of commit authors and committers. Default: false.
* `git-graph.graphColours`: Specifies the colours used on the graph.
* `git-graph.graphStyle`: Specifies the style of the graph.
* `git-graph.initialLoadCommits`: Specifies the number of commits to load initially.
* `git-graph.loadMoreCommits`: Specifies the number of commits to load when the "Load More Commits" button is pressed.
* `git-graph.maxDepthOfRepoSearch`: Specifies the maximum depth of subfolders to search when discovering repositories in the workspace. Default: 0.
* `git-graph.showCurrentBranchByDefault`: Show the current branch by default when Git Graph is opened. Default: false.
* `git-graph.showStatusBarItem`: Show a Status Bar item that opens Git Graph when clicked.
* `git-graph.showUncommittedChanges`: Show uncommitted changes. Set to false to decrease load time on large repositories.
* `git-graph.tabIconColourTheme`: Specifies the colour theme of the icon displayed on the Git Graph tab.

This extension reads the following setting:

* `git.path`: Specifies the path of a portable Git installation.

## Extension Commands

* `git-graph.view`: Git Graph: View Git Graph
* `git-graph.clearAvatarCache`: Git Graph: Clear Avatar Cache

## Install

* Visual Studio Marketplace: `erancihan.git-graph`
* Open VSX: `erancihan.git-graph`
* Manual: download the `.vsix` file from the [releases page](https://github.com/erancihan/vscode-git-graph/releases) and run `code --install-extension <file>.vsix`.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every contribution must follow the license rule described there.

## License

MIT. See [LICENSE](LICENSE). The original Git Graph up to version 1.4.6 is copyright Michael Hutchison.
