/** What the settings widget needs from the main view. */
interface SettingsWidgetView {
	getRepoState(repo: string): GG.GitRepoState;
	saveRepoState(repo: string, state: GG.GitRepoState): void;
	getRemotes(): string[];
	/** Reload branches and commits after a change that affects the graph. */
	refresh(): void;
}

type OverrideKey = 'showTags' | 'showStashes' | 'includeCommitsMentionedByReflogs' | 'onlyFollowFirstParent';
const OVERRIDES: { key: OverrideKey, label: string }[] = [
	{ key: 'showTags', label: 'Show tags' },
	{ key: 'showStashes', label: 'Show stashes' },
	{ key: 'includeCommitsMentionedByReflogs', label: 'Include commits only mentioned by reflogs' },
	{ key: 'onlyFollowFirstParent', label: 'Only follow the first parent of commits' }
];

/**
 * The Repository Settings widget: a panel with the per-repository name and overrides, the remotes
 * (add, edit, delete, fetch, prune, hide) and the user details. Remote and user changes go through
 * the extension; the name, overrides and hidden remotes are stored in the repository state.
 */
class SettingsWidget {
	private readonly view: SettingsWidgetView;
	private readonly widgetElem: HTMLElement;
	private readonly backingElem: HTMLElement;
	private repo: string | null = null;
	private settings: GG.GitRepoSettings | null = null;

	constructor(view: SettingsWidgetView) {
		this.view = view;
		this.backingElem = document.createElement('div');
		this.backingElem.id = 'settingsWidgetBacking';
		this.backingElem.addEventListener('click', () => this.hide());
		this.widgetElem = document.createElement('div');
		this.widgetElem.id = 'settingsWidget';
		document.body.appendChild(this.backingElem);
		document.body.appendChild(this.widgetElem);
	}

	/** Open the widget for a repository and ask the extension for its remotes and user details. */
	public show(repo: string) {
		this.repo = repo;
		this.settings = null;
		this.backingElem.classList.add('active');
		this.widgetElem.classList.add('active');
		this.render();
		sendMessage({ command: 'getRepoSettings', repo: repo });
	}

	public hide() {
		this.repo = null;
		this.settings = null;
		this.backingElem.classList.remove('active');
		this.widgetElem.classList.remove('active');
		this.widgetElem.innerHTML = '';
	}

	public isVisible() {
		return this.repo !== null;
	}

	/** Called with the response to getRepoSettings. */
	public loadSettings(settings: GG.GitRepoSettings | null) {
		if (this.repo === null) return;
		if (settings === null) {
			showErrorDialog(t('Unable to load the repository settings'), t('The repository could not be read.'), null);
			this.hide();
			return;
		}
		this.settings = settings;
		this.render();
	}

	/** Called after a remote or user action finished: reload the settings (and the graph) or show the error. */
	public actionCompleted(status: GG.GitCommandStatus, errorTitle: string, affectsGraph: boolean) {
		if (status !== null) {
			showErrorDialog(errorTitle, status, null);
			return;
		}
		hideDialog();
		if (this.repo !== null) sendMessage({ command: 'getRepoSettings', repo: this.repo });
		if (affectsGraph) this.view.refresh();
	}

	private render() {
		if (this.repo === null) return;
		const repo = this.repo, state = this.view.getRepoState(repo), folderName = repo.substring(repo.lastIndexOf('/') + 1);
		let html = '<div id="settingsWidgetHeader"><span class="settingsTitle">Repository Settings</span><span class="settingsRepoPath" title="' + escapeHtml(repo) + '">' + escapeHtml(state.name !== null ? state.name : folderName) + '</span><span id="settingsWidgetClose" title="' + t('Close') + '">' + svgIcons.close + '</span></div>';
		html += '<div id="settingsWidgetBody">';

		// General
		html += '<h3>' + t('General') + '</h3><table class="settingsTable"><tr><td>' + t('Name') + '</td><td><input id="settingsName" type="text" value="' + escapeHtml(state.name !== null ? state.name : '') + '" placeholder="' + escapeHtml(folderName) + '"><span class="settingsHint">' + t('Shown in the repository dropdown. Empty: the folder name.') + '</span></td></tr>';
		for (const override of OVERRIDES) {
			const value = state[override.key];
			html += '<tr><td>' + override.label + '</td><td><select class="settingsOverride" data-key="' + override.key + '">'
				+ '<option value=""' + (value === null ? ' selected' : '') + '>' + t('Default (from the extension settings)') + '</option>'
				+ '<option value="true"' + (value === true ? ' selected' : '') + '>' + t('Yes') + '</option>'
				+ '<option value="false"' + (value === false ? ' selected' : '') + '>' + t('No') + '</option></select></td></tr>';
		}
		html += '</table>';

		// Remotes
		html += '<h3>' + t('Remotes') + '</h3>';
		if (this.settings === null) {
			html += '<p class="settingsLoading">' + t('Loading ') + ELLIPSIS + '</p>';
		} else if (this.settings.remotes.length === 0) {
			html += '<p class="settingsEmpty">' + t('This repository has no remotes.') + '</p>';
		} else {
			html += '<table class="settingsTable settingsRemotes"><tr><th>' + t('Name') + '</th><th>' + t('URL') + '</th><th title="' + t('Hide the branches of this remote from the graph') + '">' + t('Hidden') + '</th><th></th></tr>';
			for (const remote of this.settings.remotes) {
				const hidden = state.hideRemotes.indexOf(remote.name) > -1, name = escapeHtml(remote.name);
				html += '<tr data-remote="' + name + '"><td class="settingsRemoteName">' + name + '</td><td class="settingsRemoteUrl">' + escapeHtml(remote.url !== null ? remote.url : '') + (remote.pushUrl !== null ? '<br><span class="settingsHint">Push: ' + escapeHtml(remote.pushUrl) + '</span>' : '') + '</td>'
					+ '<td><input type="checkbox" class="settingsRemoteHidden"' + (hidden ? ' checked' : '') + '></td>'
					+ '<td class="settingsRemoteActions"><span class="settingsBtn settingsRemoteFetch" title="' + t('Fetch from this remote') + '">' + t('Fetch') + '</span><span class="settingsBtn settingsRemotePrune" title="' + t('Delete the remote-tracking branches that no longer exist on the remote') + '">' + t('Prune') + '</span><span class="settingsBtn settingsRemoteEdit">' + t('Edit') + '</span><span class="settingsBtn settingsRemoteDelete">' + t('Delete') + '</span></td></tr>';
			}
			html += '</table>';
		}
		html += '<div class="settingsRow"><span id="settingsAddRemote" class="roundedBtn">' + t('Add Remote') + ELLIPSIS + '</span></div>';

		// User details
		// Issue linking
		const linking = state.issueLinkingConfig;
		html += '<h3>' + t('Issue Linking') + '</h3><table class="settingsTable">'
			+ '<tr><td>' + t('Issue pattern') + '</td><td><input id="settingsIssuePattern" type="text" value="' + escapeHtml(linking !== null ? linking.issue : '') + '" placeholder="#(\\d+)"><span class="settingsHint">' + t('Regular expression that matches an issue reference in a commit message. Capture groups are available to the URL.') + '</span></td></tr>'
			+ '<tr><td>' + t('Issue URL') + '</td><td><input id="settingsIssueUrl" type="text" value="' + escapeHtml(linking !== null ? linking.url : '') + '" placeholder="https://github.com/owner/repo/issues/$1"><span class="settingsHint">$1, $2 ... are replaced by the capture groups. Must start with http:// or https://.</span></td></tr></table>'
			+ '<div class="settingsRow"><span id="settingsSaveIssueLinking" class="roundedBtn">' + t('Save Issue Linking') + '</span><span id="settingsClearIssueLinking" class="roundedBtn">' + t('Remove') + '</span></div>';

		// Worktrees
		html += '<h3>' + t('Worktrees') + '</h3>';
		if (this.settings === null) {
			html += '<p class="settingsLoading">' + t('Loading ') + ELLIPSIS + '</p>';
		} else {
			html += '<table class="settingsTable settingsWorktrees"><tr><th>' + t('Folder') + '</th><th>' + t('Branch') + '</th><th></th></tr>';
			for (const worktree of this.settings.worktrees) {
				const label = worktree.branch !== null ? escapeHtml(worktree.branch) : worktree.head !== null ? 'detached at ' + abbrevCommit(worktree.head) : 'bare';
				const flags = (worktree.locked ? ' <span class="settingsHint">locked</span>' : '') + (worktree.prunable ? ' <span class="settingsHint">prunable</span>' : '');
				html += '<tr data-worktree="' + escapeHtml(worktree.path) + '"><td class="settingsWorktreePath" title="' + escapeHtml(worktree.path) + '">' + escapeHtml(worktree.path) + (worktree.isMain ? ' <span class="settingsHint">(main)</span>' : '') + '</td><td>' + label + flags + '</td>'
					+ '<td class="settingsRemoteActions">' + (worktree.isMain ? '' : '<span class="settingsBtn settingsWorktreeOpen" title="' + t('Show this worktree in the repository dropdown') + '">' + t('Add to Git Graph') + '</span><span class="settingsBtn settingsWorktreeWindow" title="' + t('Open the folder in a new window') + '">' + t('Open') + '</span><span class="settingsBtn settingsWorktreeRemove">' + t('Remove') + '</span>') + '</td></tr>';
			}
			html += '</table>';
		}
		html += '<div class="settingsRow"><span id="settingsAddWorktree" class="roundedBtn">' + t('Add Worktree') + ELLIPSIS + '</span><span id="settingsPruneWorktrees" class="roundedBtn" title="' + t('Remove the records of worktrees whose folders no longer exist') + '">' + t('Prune') + '</span></div>';

		html += '<h3>' + t('User Details') + '</h3>';
		if (this.settings === null) {
			html += '<p class="settingsLoading">' + t('Loading ') + ELLIPSIS + '</p>';
		} else {
			const user = this.settings.user;
			html += '<table class="settingsTable"><tr><td>' + t('Name') + '</td><td><input id="settingsUserName" type="text" value="' + escapeHtml(user.localName !== null ? user.localName : '') + '" placeholder="' + escapeHtml(user.globalName !== null ? user.globalName + ' (global)' : 'Not set') + '"></td></tr>'
				+ '<tr><td>' + t('Email') + '</td><td><input id="settingsUserEmail" type="text" value="' + escapeHtml(user.localEmail !== null ? user.localEmail : '') + '" placeholder="' + escapeHtml(user.globalEmail !== null ? user.globalEmail + ' (global)' : 'Not set') + '"></td></tr></table>'
				+ '<div class="settingsRow"><span id="settingsSaveUserLocal" class="roundedBtn" title="' + t('Set user.name and user.email in this repository') + '">' + t('Save for this Repository') + '</span><span id="settingsSaveUserGlobal" class="roundedBtn" title="' + t('Set user.name and user.email in your global git configuration') + '">' + t('Save Globally') + '</span></div>'
				+ '<p class="settingsHint">Empty values remove the repository\'s own setting so the global one applies.</p>';
		}

		html += '</div><div id="settingsWidgetFooter"><span id="settingsOpenExtensionSettings" class="roundedBtn">' + t('Open Extension Settings') + '</span><span id="settingsDone" class="roundedBtn">' + t('Done') + '</span></div>';
		this.widgetElem.innerHTML = html;
		this.attachListeners(repo);
	}

	private attachListeners(repo: string) {
		document.getElementById('settingsWidgetClose')!.addEventListener('click', () => this.hide());
		document.getElementById('settingsDone')!.addEventListener('click', () => this.hide());
		document.getElementById('settingsOpenExtensionSettings')!.addEventListener('click', () => sendMessage({ command: 'openExtensionSettings' }));

		const nameInput = <HTMLInputElement>document.getElementById('settingsName')!;
		nameInput.addEventListener('change', () => {
			const state = this.view.getRepoState(repo), name = nameInput.value.trim();
			state.name = name !== '' ? name : null;
			this.view.saveRepoState(repo, state);
			this.render();
		});
		addListenerToClass('settingsOverride', 'change', (e) => {
			const select = <HTMLSelectElement>e.target, key = <OverrideKey>select.dataset.key, state = this.view.getRepoState(repo);
			state[key] = select.value === '' ? null : select.value === 'true';
			this.view.saveRepoState(repo, state);
			this.view.refresh();
		});
		addListenerToClass('settingsRemoteHidden', 'change', (e) => {
			const checkbox = <HTMLInputElement>e.target, remote = this.remoteOf(checkbox), state = this.view.getRepoState(repo);
			state.hideRemotes = state.hideRemotes.filter((name) => name !== remote);
			if (checkbox.checked) state.hideRemotes.push(remote);
			this.view.saveRepoState(repo, state);
			this.view.refresh();
		});
		addListenerToClass('settingsRemoteFetch', 'click', (e) => {
			const remote = this.remoteOf(<HTMLElement>e.target);
			showActionRunningDialog(t('Fetching from {0}', escapeHtml(remote)));
			sendMessage({ command: 'fetch', repo: repo, remote: remote, prune: false, pruneTags: false });
		});
		addListenerToClass('settingsRemotePrune', 'click', (e) => {
			const remote = this.remoteOf(<HTMLElement>e.target);
			showConfirmationDialog(t('Are you sure you want to prune the remote <b><i>{0}</i></b>? Remote-tracking branches that no longer exist on the remote are deleted.', escapeHtml(remote)), () => {
				showActionRunningDialog(t('Pruning {0}', escapeHtml(remote)));
				sendMessage({ command: 'pruneRemote', repo: repo, name: remote });
			}, null);
		});
		addListenerToClass('settingsRemoteDelete', 'click', (e) => {
			const remote = this.remoteOf(<HTMLElement>e.target);
			showConfirmationDialog(t('Are you sure you want to delete the remote <b><i>{0}</i></b>? Its remote-tracking branches are removed from this repository.', escapeHtml(remote)), () => {
				showActionRunningDialog(t('Deleting Remote'));
				sendMessage({ command: 'deleteRemote', repo: repo, name: remote });
			}, null);
		});
		addListenerToClass('settingsRemoteEdit', 'click', (e) => {
			const remoteName = this.remoteOf(<HTMLElement>e.target), remote = this.settings !== null ? this.settings.remotes.find((r) => r.name === remoteName) : undefined;
			if (!remote) return;
			showFormDialog(t('Edit the remote <b><i>{0}</i></b>:', escapeHtml(remoteName)), [
				{ type: 'text-ref', name: t('Name: '), default: remote.name },
				{ type: 'text', name: t('Fetch URL: '), default: remote.url !== null ? remote.url : '', placeholder: null },
				{ type: 'text', name: t('Push URL: '), default: remote.pushUrl !== null ? remote.pushUrl : '', placeholder: t('Same as the fetch URL') }
			], t('Save Changes'), (values) => {
				showActionRunningDialog(t('Saving Remote'));
				sendMessage({ command: 'editRemote', repo: repo, nameOld: remote.name, nameNew: values[0], url: values[1], pushUrl: values[2].trim() !== '' ? values[2] : null });
			}, null);
		});
		document.getElementById('settingsAddRemote')!.addEventListener('click', () => {
			showFormDialog(t('Add a new remote to this repository:'), [
				{ type: 'text-ref', name: t('Name: '), default: this.view.getRemotes().indexOf('origin') > -1 ? '' : 'origin' },
				{ type: 'text', name: t('Fetch URL: '), default: '', placeholder: null },
				{ type: 'text', name: t('Push URL: '), default: '', placeholder: t('Same as the fetch URL') },
				{ type: 'checkbox', name: t('Fetch immediately'), value: true }
			], t('Add Remote'), (values) => {
				showActionRunningDialog(t('Adding Remote'));
				sendMessage({ command: 'addRemote', repo: repo, name: values[0], url: values[1], pushUrl: values[2].trim() !== '' ? values[2] : null, fetch: values[3] === 'checked' });
			}, null);
		});
		document.getElementById('settingsSaveIssueLinking')!.addEventListener('click', () => {
			const issue = (<HTMLInputElement>document.getElementById('settingsIssuePattern')).value.trim(), url = (<HTMLInputElement>document.getElementById('settingsIssueUrl')).value.trim();
			if (issue === '' || url === '') {
				showErrorDialog(t('Unable to save the issue linking'), t('Both the issue pattern and the issue URL are required.'), null);
				return;
			}
			if (!/^https?:\/\//i.test(url)) {
				showErrorDialog(t('Unable to save the issue linking'), t('The issue URL must start with http:// or https://.'), null);
				return;
			}
			try {
				new RegExp(issue, 'g');
			} catch (e) {
				showErrorDialog(t('Unable to save the issue linking'), t('The issue pattern is not a valid regular expression: {0}', (e instanceof Error ? e.message : String(e))), null);
				return;
			}
			const state = this.view.getRepoState(repo);
			state.issueLinkingConfig = { issue: issue, url: url };
			this.view.saveRepoState(repo, state);
			this.view.refresh();
			this.render();
		});
		document.getElementById('settingsClearIssueLinking')!.addEventListener('click', () => {
			const state = this.view.getRepoState(repo);
			state.issueLinkingConfig = null;
			this.view.saveRepoState(repo, state);
			this.view.refresh();
			this.render();
		});
		const worktreeOf = (elem: HTMLElement) => unescapeHtml((<HTMLElement>elem.closest('tr')!).dataset.worktree!);
		addListenerToClass('settingsWorktreeOpen', 'click', (e) => {
			showActionRunningDialog(t('Adding Worktree to Git Graph'));
			sendMessage({ command: 'openWorktree', repo: repo, path: worktreeOf(<HTMLElement>e.target), newWindow: false });
		});
		addListenerToClass('settingsWorktreeWindow', 'click', (e) => {
			sendMessage({ command: 'openWorktree', repo: repo, path: worktreeOf(<HTMLElement>e.target), newWindow: true });
		});
		addListenerToClass('settingsWorktreeRemove', 'click', (e) => {
			const worktreePath = worktreeOf(<HTMLElement>e.target);
			showCheckboxDialog(t('Are you sure you want to remove the worktree <b><i>{0}</i></b>? The folder is deleted; the branch is kept.', escapeHtml(worktreePath)), t('Force (also when the worktree has uncommitted changes)'), false, t('Remove Worktree'), (force) => {
				showActionRunningDialog(t('Removing Worktree'));
				sendMessage({ command: 'removeWorktree', repo: repo, path: worktreePath, force: force });
			}, null);
		});
		document.getElementById('settingsAddWorktree')!.addEventListener('click', () => {
			showFormDialog(t('Add a worktree. You choose the folder next; the branch or commit is checked out there:'), [
				{ type: 'text-ref', name: t('Branch or commit: '), default: '' },
				{ type: 'text', name: t('New branch (optional): '), default: '', placeholder: t('Create this branch at the given commit') }
			], t('Choose Folder') + ELLIPSIS, (values) => {
				sendMessage({ command: 'addWorktree', repo: repo, ref: values[0], newBranch: values[1].trim() !== '' ? values[1].trim() : null });
			}, null);
		});
		document.getElementById('settingsPruneWorktrees')!.addEventListener('click', () => {
			showActionRunningDialog(t('Pruning Worktrees'));
			sendMessage({ command: 'pruneWorktrees', repo: repo });
		});
		const saveUser = (useGlobally: boolean) => {
			const name = (<HTMLInputElement>document.getElementById('settingsUserName')).value, email = (<HTMLInputElement>document.getElementById('settingsUserEmail')).value;
			if (useGlobally && (name.trim() === '' || email.trim() === '')) {
				showErrorDialog(t('Unable to save the user details'), t('A name and an email address are required to save globally.'), null);
				return;
			}
			showActionRunningDialog(t('Saving User Details'));
			sendMessage({ command: 'setUserDetails', repo: repo, name: name, email: email, useGlobally: useGlobally });
		};
		const localBtn = document.getElementById('settingsSaveUserLocal'), globalBtn = document.getElementById('settingsSaveUserGlobal');
		if (localBtn !== null) localBtn.addEventListener('click', () => saveUser(false));
		if (globalBtn !== null) globalBtn.addEventListener('click', () => saveUser(true));
	}

	private remoteOf(elem: HTMLElement) {
		return unescapeHtml((<HTMLElement>elem.closest('tr')!).dataset.remote!);
	}
}
