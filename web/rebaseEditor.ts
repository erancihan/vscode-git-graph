/** What the rebase editor needs from the main view. */
interface RebaseEditorView {
	/** Reload the graph after the rebase ran (it may have stopped: the operation bar shows that). */
	refresh(): void;
}

const REBASE_ACTION_OPTIONS: { value: GG.GitRebaseAction, label: string, hint: string }[] = [
	{ value: 'pick', label: 'Pick', hint: 'Keep the commit as it is' },
	{ value: 'reword', label: 'Reword', hint: 'Keep the changes, replace the message' },
	{ value: 'edit', label: 'Edit', hint: 'Stop after this commit to amend it; continue from the bar above the graph' },
	{ value: 'squash', label: 'Squash', hint: 'Merge into the commit above; a message below replaces the combined message' },
	{ value: 'fixup', label: 'Fixup', hint: 'Merge into the commit above and discard this message' },
	{ value: 'drop', label: 'Drop', hint: 'Remove the commit' }
];

/**
 * The interactive rebase editor: a panel listing the commits after a chosen commit up to HEAD,
 * oldest first, with an action per commit, messages for reword and squash, and reordering. The
 * extension builds the list (`getRebaseTodo`) and runs the rebase (`interactiveRebase`).
 */
class RebaseEditor {
	private readonly view: RebaseEditorView;
	private readonly widgetElem: HTMLElement;
	private readonly backingElem: HTMLElement;
	private repo: string | null = null;
	private baseHash: string | null = null;
	private headHash: string | null = null;
	private pushed: boolean = false;
	private todo: GG.GitRebaseTodoEntry[] | null = null;
	private original: GG.GitRebaseTodoEntry[] | null = null;

	constructor(view: RebaseEditorView) {
		this.view = view;
		this.backingElem = document.createElement('div');
		this.backingElem.id = 'rebaseEditorBacking';
		this.backingElem.addEventListener('click', () => this.hide());
		this.widgetElem = document.createElement('div');
		this.widgetElem.id = 'rebaseEditor';
		document.body.appendChild(this.backingElem);
		document.body.appendChild(this.widgetElem);
	}

	/** Open the editor for the commits after `baseHash` and ask the extension for the list. */
	public show(repo: string, baseHash: string) {
		this.repo = repo;
		this.baseHash = baseHash;
		this.headHash = null;
		this.todo = null;
		this.original = null;
		this.pushed = false;
		this.backingElem.classList.add('active');
		this.widgetElem.classList.add('active');
		this.render();
		sendMessage({ command: 'getRebaseTodo', repo: repo, baseHash: baseHash });
	}

	public hide() {
		this.repo = null;
		this.baseHash = null;
		this.todo = null;
		this.original = null;
		this.backingElem.classList.remove('active');
		this.widgetElem.classList.remove('active');
		this.widgetElem.innerHTML = '';
	}

	public isVisible() {
		return this.repo !== null;
	}

	/** Called with the response to getRebaseTodo. */
	public loadTodo(msg: GG.ResponseGetRebaseTodo) {
		if (this.repo === null || msg.baseHash !== this.baseHash) return;
		if (msg.todo === null) {
			this.hide();
			showErrorDialog('Unable to prepare the Interactive Rebase', msg.error !== null ? msg.error : 'The commits could not be listed.', null);
			return;
		}
		this.headHash = msg.headHash;
		this.pushed = msg.pushed;
		this.original = msg.todo.map((entry) => ({ ...entry }));
		this.todo = msg.todo.map((entry) => ({ ...entry }));
		this.render();
	}

	private render() {
		if (this.repo === null || this.baseHash === null) return;
		const todo = this.todo;
		let html = '<div id="rebaseEditorHeader"><span class="settingsTitle">Interactive Rebase</span><span class="settingsRepoPath">onto ' + abbrevCommit(this.baseHash) + (todo !== null ? ' · ' + todo.length + ' commit' + (todo.length !== 1 ? 's' : '') : '') + '</span><span id="rebaseEditorClose" title="Close">' + svgIcons.close + '</span></div>';
		html += '<div id="rebaseEditorBody">';
		if (todo === null) {
			html += '<p class="settingsLoading">Loading ' + ELLIPSIS + '</p>';
		} else {
			html += '<p class="rebaseEditorIntro">The commits are listed oldest first, as git replays them. Choose an action for each commit and reorder them with the arrows. Nothing changes until you start the rebase.</p>';
			if (this.pushed) html += '<p class="rebaseEditorWarning">' + svgIcons.alert + 'The current branch is already on its upstream branch. Rewriting it means the next push needs force-with-lease.</p>';
			html += '<table class="settingsTable rebaseTodo"><tr><th></th><th>Action</th><th>Commit</th><th>Subject</th></tr>';
			for (let i = 0; i < todo.length; i++) {
				const entry = todo[i], withMessage = entry.action === 'reword' || entry.action === 'squash';
				html += '<tr class="rebaseEntry rebaseAction-' + entry.action + '" data-index="' + i + '">'
					+ '<td class="rebaseOrder"><span class="rebaseMove' + (i === 0 ? ' disabled' : '') + '" data-dir="-1" title="Move up (earlier)">&#9650;</span><span class="rebaseMove' + (i === todo.length - 1 ? ' disabled' : '') + '" data-dir="1" title="Move down (later)">&#9660;</span></td>'
					+ '<td><select class="rebaseActionSelect">' + REBASE_ACTION_OPTIONS.map((option) => '<option value="' + option.value + '" title="' + option.hint + '"' + (option.value === entry.action ? ' selected' : '') + '>' + option.label + '</option>').join('') + '</select></td>'
					+ '<td class="rebaseHash" title="' + escapeHtml(entry.hash) + '">' + abbrevCommit(entry.hash) + '</td>'
					+ '<td class="rebaseSubject"><span class="rebaseSubjectText">' + escapeHtml(entry.subject) + '</span>'
					+ (entry.action === 'edit' ? '<span class="settingsHint">The rebase stops after this commit. Amend it, then use Continue in the bar above the graph.</span>' : '')
					+ (withMessage ? '<textarea class="rebaseMessage" rows="3" placeholder="' + (entry.action === 'reword' ? 'New commit message' : 'Leave empty to keep the combined message git composes') + '">' + escapeHtml(entry.message !== null ? entry.message : '') + '</textarea>' : '')
					+ '</td></tr>';
			}
			html += '</table>';
		}
		html += '</div>';
		html += '<div id="rebaseEditorFooter"><span class="rebaseEditorSummary">' + (todo !== null ? this.describeTodo(todo) : '') + '</span>'
			+ '<span id="rebaseEditorReset" class="roundedBtn' + (todo === null ? ' disabled' : '') + '" title="Back to the list as git proposed it">Reset</span>'
			+ '<span id="rebaseEditorCancel" class="roundedBtn">Cancel</span>'
			+ '<span id="rebaseEditorStart" class="roundedBtn' + (todo === null ? ' disabled' : '') + '">Start Rebase</span></div>';
		this.widgetElem.innerHTML = html;
		this.attachListeners();
	}

	private describeTodo(todo: GG.GitRebaseTodoEntry[]) {
		const counts: { [action: string]: number } = {};
		for (const entry of todo) counts[entry.action] = (counts[entry.action] || 0) + 1;
		const parts = REBASE_ACTION_OPTIONS.filter((option) => counts[option.value] > 0 && option.value !== 'pick').map((option) => counts[option.value] + ' ' + option.label.toLowerCase());
		const reordered = this.original !== null && todo.some((entry, i) => this.original![i].hash !== entry.hash);
		if (reordered) parts.push('reordered');
		return parts.length > 0 ? parts.join(', ') : 'No changes yet';
	}

	private attachListeners() {
		document.getElementById('rebaseEditorClose')!.addEventListener('click', () => this.hide());
		document.getElementById('rebaseEditorCancel')!.addEventListener('click', () => this.hide());
		document.getElementById('rebaseEditorReset')!.addEventListener('click', () => {
			if (this.original === null) return;
			this.todo = this.original.map((entry) => ({ ...entry }));
			this.render();
		});
		document.getElementById('rebaseEditorStart')!.addEventListener('click', () => this.start());
		addListenerToClass('rebaseMove', 'click', (e) => {
			const elem = <HTMLElement>(<Element>e.target).closest('.rebaseMove');
			if (elem === null || elem.classList.contains('disabled') || this.todo === null) return;
			const index = this.indexOf(elem), to = index + parseInt(elem.dataset.dir!);
			if (index < 0 || to < 0 || to >= this.todo.length) return;
			const todo = this.todo.slice(), [entry] = todo.splice(index, 1);
			todo.splice(to, 0, entry);
			this.todo = todo;
			this.render();
		});
		addListenerToClass('rebaseActionSelect', 'change', (e) => {
			const elem = <HTMLSelectElement>e.target, index = this.indexOf(elem);
			if (this.todo === null || index < 0) return;
			const action = <GG.GitRebaseAction>elem.value;
			const message = action === 'reword' && (this.todo[index].message === null || this.todo[index].message === '') ? this.todo[index].subject : this.todo[index].message;
			this.todo[index] = { ...this.todo[index], action: action, message: message };
			this.render();
		});
		addListenerToClass('rebaseMessage', 'input', (e) => {
			const elem = <HTMLTextAreaElement>e.target, index = this.indexOf(elem);
			if (this.todo === null || index < 0) return;
			this.todo[index] = { ...this.todo[index], message: elem.value };
		});
	}

	private indexOf(elem: HTMLElement) {
		const row = <HTMLElement | null>elem.closest('.rebaseEntry');
		return row !== null && typeof row.dataset.index === 'string' ? parseInt(row.dataset.index) : -1;
	}

	private start() {
		if (this.repo === null || this.baseHash === null || this.headHash === null || this.todo === null) return;
		const todo = this.todo.map((entry) => ({ ...entry, message: (entry.action === 'reword' || entry.action === 'squash') && entry.message !== null && entry.message.trim() !== '' ? entry.message : null }));
		const firstKept = todo.filter((entry) => entry.action !== 'drop')[0];
		if (firstKept === undefined) {
			showErrorDialog('Unable to Rebase', 'Every commit is dropped. Use "Reset current branch to this Commit" instead.', null);
			return;
		}
		if (firstKept.action === 'squash' || firstKept.action === 'fixup') {
			showErrorDialog('Unable to Rebase', 'The first kept commit cannot be squashed or fixed up: there is no earlier commit to merge it into.', null);
			return;
		}
		if (todo.some((entry) => entry.action === 'reword' && entry.message === null)) {
			showErrorDialog('Unable to Rebase', 'A reworded commit needs a message.', null);
			return;
		}
		const repo = this.repo, baseHash = this.baseHash, headHash = this.headHash;
		const summary = this.describeTodo(todo);
		showConfirmationDialog('Rewrite the <b>current branch</b> with these changes (' + escapeHtml(summary) + ')?', () => {
			this.hide();
			showActionRunningDialog('Rebasing');
			sendMessage({ command: 'interactiveRebase', repo: repo, baseHash: baseHash, headHash: headHash, todo: todo });
		}, null);
	}

	/** Called with the response to interactiveRebase. */
	public rebaseCompleted(status: GG.GitCommandStatus) {
		if (status === null) {
			hideDialog();
		} else {
			showErrorDialog('Unable to Rebase', status, null);
		}
		this.view.refresh();
	}
}
