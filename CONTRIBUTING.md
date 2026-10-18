# Contributing to Git Graph

Thank you for taking the time to contribute.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report unacceptable behavior by opening an issue.

## License rule for all contributions

This fork continues the last MIT-licensed version of Git Graph (upstream commit `4af8583`, version 1.4.6). Later upstream code is under a license that forbids distributing derivative works.

Do not copy, port, or paraphrase code from:
- `mhutchie/vscode-git-graph` after commit `4af8583`
- any fork that descends from that later code (for example `hansu/vscode-git-graph` or `git-hub-tig/vscode-git-graph`)
- AGPL projects such as `PlohnenSoftware/git-graph-libre`

You can re-implement a feature from its description. You can reuse MIT-licensed code from `asispts/neo-git-graph` with attribution. See `docs/UPSTREAM_GAP.md` for the list of features to re-implement and `docs/UPSTREAM_PRS.md` for upstream pull requests under review.

## Reporting bugs and suggesting features

Open an issue with the matching template. Search the existing issues first.

## Development

1. Install [Node.js](https://nodejs.org/) 20 or later.
2. Clone this repository and open it in Visual Studio Code.
3. Run `npm install`.
4. Create a branch for your change.

Scripts:
- `npm run compile`: compile the extension host code (`src/`) and the webview code (`web/`).
- `npm run compile-src`: compile the extension host code only.
- `npm run compile-web`: compile and minify the webview code.
- `npm run compile-web-debug`: compile the webview code without minification.
- `npm run lint`: run ESLint.
- `npm run package`: build a `.vsix` file.

Testing:
- Press F5 to launch the Extension Development Host with the compiled extension.
- Run the command `Developer: Open Webview Developer Tools` to inspect the webview.
- To test a packaged build, run `npm run package` and then `code --install-extension <file>.vsix`.

## Translations

The user interface uses the VS Code localization mechanisms. Translations are community contributions.

* `package.nls.json` holds the English text of the command titles and setting descriptions. Copy it to `package.nls.<locale>.json` (for example `package.nls.de.json`) and translate the values. Keys you leave out fall back to English.
* `l10n/bundle.l10n.json` holds the English text of the messages, menus and dialogs. Copy it to `l10n/bundle.l10n.<locale>.json` and translate the values. Keep the `{0}`, `{1}` placeholders and the HTML tags (`<b>`, `<i>`) where the English text has them. Keys you leave out fall back to English.
* After changing a string in the sources, run `npm run l10n` to regenerate `l10n/bundle.l10n.json`; the test suite checks that the file is current and that every translation only contains known keys with matching placeholders.
* Write translations yourself. Do not copy translation files from other extensions or forks (see the license rule above).

## Pull requests

Open a pull request against `master`. Fill in the template, including the license checklist. CI runs lint, compile, and packaging on every pull request.

## Style

Use tabs, single quotes, and semicolons. Run "Format Document" in Visual Studio Code before committing. Line endings are LF.
