# Security Policy

## Supported versions

Only the latest release on the Visual Studio Marketplace and Open VSX receives fixes.

## Reporting a vulnerability

Do not open a public issue for a vulnerability.

Use GitHub private vulnerability reporting: open the "Security" tab of this repository and click "Report a vulnerability". You will get a response within 14 days.

## What counts

- Code execution or command injection through repository content, branch names, commit messages, file paths or remote URLs.
- Webview content injection (HTML or script) from repository data.
- Leaks of credentials or tokens handled by the extension.
- Supply chain problems in the build, release workflow or dependencies.

## How releases are protected

- The default branch accepts changes only through pull requests with a passing CI build.
- Release packages are built in GitHub Actions from a version tag. Publishing tokens exist only as repository secrets and are used in a job that runs no third-party actions.
- Third-party actions are pinned to a commit SHA. Dependabot keeps pins and dependencies current.
- Secret scanning with push protection and CodeQL are enabled on the repository.

## Credential prompts (askpass)

When `git-graph.integratedAskpass` is enabled, git may call `resources/askpass.sh`, which runs `out/askpassMain.js` with Node. The helper connects to a pipe (`git-graph-askpass-<random>` in the temp folder, or a named pipe on Windows) that the extension created for this session, sends the prompt text with a 48-character random nonce, and prints the answer. The extension refuses requests whose nonce does not match, shows one prompt at a time, and never stores what was typed. Set the setting to `false` to disable the helper; git then fails instead of prompting.

## CI status tokens

The CI status feature (`git-graph.ciStatus.enabled`, off by default) reads check results from the provider API. The github.com sign-in token from the built-in GitHub authentication is sent to `api.github.com` only. Every other host (GitHub Enterprise, GitLab, self-hosted instances mapped in `git-graph.ciStatus.hosts`) gets its own personal access token, asked for once and stored in the VS Code secret storage under a key that contains the host name, so a token is never sent to a different host. Both settings have application scope: workspace settings cannot switch the feature on or add hosts. Only `http(s)` links from the provider are kept for the click-through.

## Shared repository settings file

`.vscode/git-graph.json` can carry Git Graph settings for a team. Because it is part of a repository, the extension treats it as untrusted input: it is read and written only when `.vscode` and the file itself are not symbolic links and resolve inside the repository, it is parsed field by field with the same validation as the stored state (unknown fields are ignored), the issue linking pattern must be short, compile and contain no nested quantifiers, and nothing is applied before the user confirms a prompt that lists the incoming values. The display name and column layout are never exported.

## GPG passphrase prompt

With `git-graph.gpg.passphrasePrompt`, the git processes Git Graph starts use `resources/gpg-wrapper.sh` as `gpg.program`. The wrapper runs the configured gpg unchanged first. Only when that fails does it ask the extension for the passphrase over the askpass pipe (random pipe name, per-session nonce, same channel as the credential prompts) and run gpg again with `--pinentry-mode loopback --passphrase-fd 3`. The passphrase stays in memory, is never written to disk, never appears on a command line, and is not stored by the extension; gpg-agent may cache it according to its own configuration. The setting has application scope, so a workspace cannot switch the wrapper on or off.
