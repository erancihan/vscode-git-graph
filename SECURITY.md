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
