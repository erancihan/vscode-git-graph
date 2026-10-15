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
