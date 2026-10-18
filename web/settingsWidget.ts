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
			showErrorDialog('Unable to load the repository settings', 'The repository could not be read.', null);
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
		let html = '<div id="settingsWidgetHeader"><span class="settingsTitle">Repository Settings</span><span class="settingsRepoPath" title="' + escapeHtml(repo) + '">' + escapeHtml(state.name !== null ? state.name : folderName) + '</span><span id="settingsWidgetClose" title="Close">' + svgIcons.close + '</span></div>';
		html += '<div id="settingsWidgetBody">';

		// General
		html += '<h3>General</h3><table class="settingsTable"><tr><td>Name</td><td><input id="settingsName" type="text" value="' + escapeHtml(state.name !== null ? state.name : '') + '" placeholder="' + escapeHtml(folderName) + '"><span class="settingsHint">Shown in the repository dropdown. Empty: the folder name.</span></td></tr>';
		for (const override of OVERRIDES) {
			const value = state[override.key];
			html += '<tr><td>' + override.label + '</td><td><select class="settingsOverride" data-key="' + override.key + '">'
				+ '<option value=""' + (value === null ? ' selected' : '') + '>Default (from the extension settings)</option>'
				+ '<option value="true"' + (value === true ? ' selected' : '') + '>Yes</option>'
				+ '<option value="false"' + (value === false ? ' selected' : '') + '>No</option></select></td></tr>';
		}
		html += '</table>';

		// Remotes
		html += '<h3>Remotes</h3>';
		if (this.settings === null) {
			html += '<p class="settingsLoading">Loading ' + ELLIPSIS + '</p>';
		} else if (this.settings.remotes.length === 0) {
			html += '<p class="settingsEmpty">This repository has no remotes.</p>';
		} else {
			html += '<table class="settingsTable settingsRemotes"><tr><th>Name</th><th>URL</th><th title="Hide the branches of this remote from the graph">Hidden</th><th></th></tr>';
			for (const remote of this.settings.remotes) {
				const hidden = state.hideRemotes.indexOf(remote.name) > -1, name = escapeHtml(remote.name);
				html += '<tr data-remote="' + name + '"><td class="settingsRemoteName">' + name + '</td><td class="settingsRemoteUrl">' + escapeHtml(remote.url !== null ? remote.url : '') + (remote.pushUrl !== null ? '<br><span class="settingsHint">Push: ' + escapeHtml(remote.pushUrl) + '</span>' : '') + '</td>'
					+ '<td><input type="checkbox" class="settingsRemoteHidden"' + (hidden ? ' checked' : '') + '></td>'
					+ '<td class="settingsRemoteActions"><span class="settingsBtn settingsRemoteFetch" title="Fetch from this remote">Fetch</span><span class="settingsBtn settingsRemotePrune" title="Delete the remote-tracking branches that no longer exist on the remote">Prune</span><span class="settingsBtn settingsRemoteEdit">Edit</span><span class="settingsBtn settingsRemoteDelete">Delete</span></td></tr>';
			}
			html += '</table>';
		}
		html += '<div class="settingsRow"><span id="settingsAddRemote" class="roundedBtn">Add Remote' + ELLIPSIS + '</span></div>';

		// User details
		html += '<h3>User Details</h3>';
		if (this.settings === null) {
			html += '<p class="settingsLoading">Loading ' + ELLIPSIS + '</p>';
		} else {
			const user = this.settings.user;
			html += '<table class="settingsTable"><tr><td>Name</td><td><input id="settingsUserName" type="text" value="' + escapeHtml(user.localName !== null ? user.localName : '') + '" placeholder="' + escapeHtml(user.globalName !== null ? user.globalName + ' (global)' : 'Not set') + '"></td></tr>'
				+ '<tr><td>Email</td><td><input id="settingsUserEmail" type="text" value="' + escapeHtml(user.localEmail !== null ? user.localEmail : '') + '" placeholder="' + escapeHtml(user.globalEmail !== null ? user.globalEmail + ' (global)' : 'Not set') + '"></td></tr></table>'
				+ '<div class="settingsRow"><span id="settingsSaveUserLocal" class="roundedBtn" title="Set user.name and user.email in this repository">Save for this Repository</span><span id="settingsSaveUserGlobal" class="roundedBtn" title="Set user.name and user.email in your global git configuration">Save Globally</span></div>'
				+ '<p class="settingsHint">Empty values remove the repository\'s own setting so the global one applies.</p>';
		}

		html += '</div><div id="settingsWidgetFooter"><span id="settingsOpenExtensionSettings" class="roundedBtn">Open Extension Settings</span><span id="settingsDone" class="roundedBtn">Done</span></div>';
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
			showActionRunningDialog('Fetching from ' + escapeHtml(remote));
			sendMessage({ command: 'fetch', repo: repo, remote: remote, prune: false, pruneTags: false });
		});
		addListenerToClass('settingsRemotePrune', 'click', (e) => {
			const remote = this.remoteOf(<HTMLElement>e.target);
			showConfirmationDialog('Are you sure you want to prune the remote <b><i>' + escapeHtml(remote) + '</i></b>? Remote-tracking branches that no longer exist on the remote are deleted.', () => {
				showActionRunningDialog('Pruning ' + escapeHtml(remote));
				sendMessage({ command: 'pruneRemote', repo: repo, name: remote });
			}, null);
		});
		addListenerToClass('settingsRemoteDelete', 'click', (e) => {
			const remote = this.remoteOf(<HTMLElement>e.target);
			showConfirmationDialog('Are you sure you want to delete the remote <b><i>' + escapeHtml(remote) + '</i></b>? Its remote-tracking branches are removed from this repository.', () => {
				showActionRunningDialog('Deleting Remote');
				sendMessage({ command: 'deleteRemote', repo: repo, name: remote });
			}, null);
		});
		addListenerToClass('settingsRemoteEdit', 'click', (e) => {
			const remoteName = this.remoteOf(<HTMLElement>e.target), remote = this.settings !== null ? this.settings.remotes.find((r) => r.name === remoteName) : undefined;
			if (!remote) return;
			showFormDialog('Edit the remote <b><i>' + escapeHtml(remoteName) + '</i></b>:', [
				{ type: 'text-ref', name: 'Name: ', default: remote.name },
				{ type: 'text', name: 'Fetch URL: ', default: remote.url !== null ? remote.url : '', placeholder: null },
				{ type: 'text', name: 'Push URL: ', default: remote.pushUrl !== null ? remote.pushUrl : '', placeholder: 'Same as the fetch URL' }
			], 'Save Changes', (values) => {
				showActionRunningDialog('Saving Remote');
				sendMessage({ command: 'editRemote', repo: repo, nameOld: remote.name, nameNew: values[0], url: values[1], pushUrl: values[2].trim() !== '' ? values[2] : null });
			}, null);
		});
		document.getElementById('settingsAddRemote')!.addEventListener('click', () => {
			showFormDialog('Add a new remote to this repository:', [
				{ type: 'text-ref', name: 'Name: ', default: this.view.getRemotes().indexOf('origin') > -1 ? '' : 'origin' },
				{ type: 'text', name: 'Fetch URL: ', default: '', placeholder: null },
				{ type: 'text', name: 'Push URL: ', default: '', placeholder: 'Same as the fetch URL' },
				{ type: 'checkbox', name: 'Fetch immediately', value: true }
			], 'Add Remote', (values) => {
				showActionRunningDialog('Adding Remote');
				sendMessage({ command: 'addRemote', repo: repo, name: values[0], url: values[1], pushUrl: values[2].trim() !== '' ? values[2] : null, fetch: values[3] === 'checked' });
			}, null);
		});
		const saveUser = (useGlobally: boolean) => {
			const name = (<HTMLInputElement>document.getElementById('settingsUserName')).value, email = (<HTMLInputElement>document.getElementById('settingsUserEmail')).value;
			if (useGlobally && (name.trim() === '' || email.trim() === '')) {
				showErrorDialog('Unable to save the user details', 'A name and an email address are required to save globally.', null);
				return;
			}
			showActionRunningDialog('Saving User Details');
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
