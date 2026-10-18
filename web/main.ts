class GitGraphView {
	private gitRepos: GG.GitRepoSet;
	private gitBranches: string[] = [];
	private gitBranchHead: string | null = null;
	private gitRemotes: string[] = [];
	private commits: GG.GitCommitNode[] = [];
	private commitHead: string | null = null;
	private commitLookup: { [hash: string]: number } = {};
	private avatars: AvatarImageCollection = {};
	private currentBranch: string | null = null;
	private currentRepo!: string;

	private graph: Graph;
	private findWidget: FindWidget;
	private config: Config;
	private moreCommitsAvailable: boolean = false;
	private showRemoteBranches: boolean = true;
	private expandedCommit: ExpandedCommit | null = null;
	private maxCommits: number;
	private scrollToHeadPending: boolean;
	private lastStashScrolledTo: number = -1;
	private fileViewType: GG.FileViewType;

	private tableElem: HTMLElement;
	private footerElem: HTMLElement;
	private repoDropdown: Dropdown;
	private branchDropdown: Dropdown;
	private showRemoteBranchesElem: HTMLInputElement;
	private scrollShadowElem: HTMLElement;

	private loadBranchesCallback: ((changes: boolean, isRepo: boolean) => void) | null = null;
	private loadCommitsCallback: ((changes: boolean) => void) | null = null;

	constructor(repos: GG.GitRepoSet, lastActiveRepo: string | null, config: Config, prevState: WebViewState | null) {
		this.gitRepos = repos;
		this.config = config;
		this.maxCommits = config.initialLoadCommits;
		this.showRemoteBranches = config.showRemoteBranches;
		this.scrollToHeadPending = config.scrollToHeadOnLoad && prevState === null;
		this.fileViewType = prevState !== null && prevState.fileViewType ? prevState.fileViewType : config.commitDetailsView.fileViewType;
		this.graph = new Graph('commitGraph', this.config);
		this.tableElem = document.getElementById('commitTable')!;
		this.registerTableListeners();
		this.findWidget = new FindWidget({
			getCommits: () => this.commits,
			getRowElem: (id) => <HTMLElement | null>this.tableElem.querySelector('tr.commit[data-id="' + id + '"]'),
			isCommitDetailsOpen: () => this.expandedCommit !== null,
			openCommitDetails: (rowElem) => {
				if (this.expandedCommit === null || this.expandedCommit.hash !== rowElem.dataset.hash) this.loadCommitDetails(rowElem);
			}
		});
		document.addEventListener('keydown', (e) => {
			if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
			const key = e.key.toLowerCase(), shortcuts = this.config.keyboardShortcuts;
			if (key === shortcuts.find) {
				e.preventDefault();
				this.findWidget.show();
			} else if (key === shortcuts.refresh) {
				e.preventDefault();
				this.refresh(true);
			} else if (key === shortcuts.scrollToHead) {
				e.preventDefault();
				this.scrollToHead();
			} else if (key === shortcuts.scrollToStash) {
				e.preventDefault();
				this.scrollToStash(e.shiftKey ? -1 : 1);
			}
		});
		this.footerElem = document.getElementById('footer')!;
		this.repoDropdown = new Dropdown('repoSelect', true, 'Repos', value => {
			this.currentRepo = value;
			this.maxCommits = this.config.initialLoadCommits;
			this.scrollToHeadPending = this.config.scrollToHeadOnLoad;
			this.expandedCommit = null;
			this.currentBranch = null;
			this.saveState();
			this.refresh(true);
		});
		this.branchDropdown = new Dropdown('branchSelect', false, 'Branches', value => {
			this.currentBranch = value;
			this.maxCommits = this.config.initialLoadCommits;
			this.expandedCommit = null;
			this.saveState();
			this.renderShowLoading();
			this.requestLoadCommits(true, () => { });
		});
		this.showRemoteBranchesElem = <HTMLInputElement>document.getElementById('showRemoteBranchesCheckbox')!;
		this.showRemoteBranchesElem.addEventListener('change', () => {
			this.showRemoteBranches = this.showRemoteBranchesElem.checked;
			this.saveState();
			this.refresh(true);
		});
		this.scrollShadowElem = <HTMLInputElement>document.getElementById('scrollShadow')!;
		document.getElementById('refreshBtn')!.addEventListener('click', () => {
			this.refresh(true);
		});
		document.getElementById('fetchBtn')!.addEventListener('click', () => {
			showActionRunningDialog('Fetching from Remote(s)');
			sendMessage({ command: 'fetch', repo: this.currentRepo!, remote: null, prune: this.config.fetchAndPrune, pruneTags: this.config.fetchAndPruneTags });
		});
		this.observeWindowSizeChanges();
		this.observeWebviewStyleChanges();
		this.observeWebviewScroll();

		this.renderShowLoading();
		if (prevState) {
			this.currentBranch = prevState.currentBranch;
			this.showRemoteBranches = prevState.showRemoteBranches;
			this.showRemoteBranchesElem.checked = this.showRemoteBranches;
			if (typeof this.gitRepos[prevState.currentRepo] !== 'undefined') {
				this.currentRepo = prevState.currentRepo;
				this.maxCommits = prevState.maxCommits;
				this.expandedCommit = prevState.expandedCommit;
				this.avatars = prevState.avatars;
				this.loadBranches(prevState.gitBranches, prevState.gitBranchHead, prevState.gitRemotes || [], true, true);
				this.loadCommits(prevState.commits, prevState.commitHead, prevState.moreCommitsAvailable, true);
			}
		}
		this.loadRepos(this.gitRepos, lastActiveRepo);
		this.requestLoadBranchesAndCommits(false);
	}

	public getDialogDefaults() {
		return this.config.dialogDefaults;
	}

	/** Switch to a repository (for example the one of the active editor). Ignored when it is unknown or already shown. */
	public selectRepo(repo: string) {
		if (typeof this.gitRepos[repo] === 'undefined' || repo === this.currentRepo) return;
		this.currentRepo = repo;
		this.maxCommits = this.config.initialLoadCommits;
		this.expandedCommit = null;
		this.currentBranch = null;
		this.scrollToHeadPending = this.config.scrollToHeadOnLoad;
		this.saveState();
		this.repoDropdown.setOptions(this.repoDropdown.getOptions(), this.currentRepo);
		this.refresh(true);
	}

	/* Loading Data */
	public loadRepos(repos: GG.GitRepoSet, lastActiveRepo: string | null) {
		this.gitRepos = repos;
		this.saveState();

		let repoPaths = Object.keys(repos), changedRepo = false;
		if (typeof repos[this.currentRepo] === 'undefined') {
			this.currentRepo = lastActiveRepo !== null && typeof repos[lastActiveRepo] !== 'undefined' ? lastActiveRepo : repoPaths[0];
			this.saveState();
			changedRepo = true;
		}

		let options = [], repoComps, i;
		for (i = 0; i < repoPaths.length; i++) {
			repoComps = repoPaths[i].split('/');
			options.push({ name: repoComps[repoComps.length - 1], value: repoPaths[i] });
		}
		document.getElementById('repoControl')!.style.display = repoPaths.length > 1 ? 'inline' : 'none';
		this.repoDropdown.setOptions(options, this.currentRepo);

		if (changedRepo) {
			this.refresh(true);
		}
	}

	public loadBranches(branchOptions: string[], branchHead: string | null, remotes: string[], hard: boolean, isRepo: boolean) {
		if (!isRepo) {
			this.triggerLoadBranchesCallback(false, isRepo);
			return;
		}
		if (!hard && arraysEqual(this.gitBranches, branchOptions, (a, b) => a === b) && this.gitBranchHead === branchHead && arraysEqual(this.gitRemotes, remotes, (a, b) => a === b)) {
			this.triggerLoadBranchesCallback(false, isRepo);
			return;
		}

		this.gitBranches = branchOptions;
		this.gitBranchHead = branchHead;
		this.gitRemotes = remotes;
		document.getElementById('fetchBtn')!.style.display = remotes.length > 0 ? '' : 'none';
		if (this.currentBranch === null || (this.currentBranch !== '' && this.gitBranches.indexOf(this.currentBranch) === -1)) {
			this.currentBranch = this.config.showCurrentBranchByDefault && this.gitBranchHead !== null ? this.gitBranchHead : '';
		}
		this.saveState();

		const options = [{ name: 'Show All', value: '' }];
		for (let i = 0; i < this.gitBranches.length; i++) {
			options.push({ name: this.gitBranches[i].indexOf('remotes/') === 0 ? this.gitBranches[i].substring(8) : this.gitBranches[i], value: this.gitBranches[i] });
		}
		this.branchDropdown.setOptions(options, this.currentBranch);

		this.triggerLoadBranchesCallback(true, isRepo);
	}
	private triggerLoadBranchesCallback(changes: boolean, isRepo: boolean) {
		if (this.loadBranchesCallback !== null) {
			this.loadBranchesCallback(changes, isRepo);
			this.loadBranchesCallback = null;
		}
	}

	public loadCommits(commits: GG.GitCommitNode[], commitHead: string | null, moreAvailable: boolean, hard: boolean) {
		if (!hard && this.moreCommitsAvailable === moreAvailable && this.commitHead === commitHead && arraysEqual(this.commits, commits, (a, b) => a.hash === b.hash && arraysEqual(a.refs, b.refs, (a, b) => a.name === b.name && a.type === b.type) && arraysEqual(a.parentHashes, b.parentHashes, (a, b) => a === b))) {
			if (this.commits.length > 0 && this.commits[0].hash === '*') {
				this.commits[0] = commits[0];
				this.saveState();
				this.renderUncommitedChanges();
			}
			this.triggerLoadCommitsCallback(false);
			return;
		}

		this.moreCommitsAvailable = moreAvailable;
		this.commits = commits;
		this.commitHead = commitHead;
		this.commitLookup = {};
		this.saveState();

		let i: number, expandedCommitVisible = false, avatarsNeeded: { [email: string]: string[] } = {};
		for (i = 0; i < this.commits.length; i++) {
			this.commitLookup[this.commits[i].hash] = i;
			if (this.expandedCommit !== null && this.expandedCommit.hash === this.commits[i].hash) expandedCommitVisible = true;
			if (this.config.fetchAvatars && typeof this.avatars[this.commits[i].email] !== 'string' && this.commits[i].email !== '') {
				if (typeof avatarsNeeded[this.commits[i].email] === 'undefined') {
					avatarsNeeded[this.commits[i].email] = [this.commits[i].hash];
				} else {
					avatarsNeeded[this.commits[i].email].push(this.commits[i].hash);
				}
			}
		}

		this.graph.loadCommits(this.commits, this.commitHead, this.commitLookup);

		if (this.expandedCommit !== null && !expandedCommitVisible) {
			this.expandedCommit = null;
			this.saveState();
		}
		this.render();
		if (this.scrollToHeadPending) {
			this.scrollToHeadPending = false;
			this.scrollToHead();
		}

		this.triggerLoadCommitsCallback(true);
		this.fetchAvatars(avatarsNeeded);
	}
	private triggerLoadCommitsCallback(changes: boolean) {
		if (this.loadCommitsCallback !== null) {
			this.loadCommitsCallback(changes);
			this.loadCommitsCallback = null;
		}
	}

	public loadAvatar(email: string, image: string) {
		this.avatars[email] = image;
		this.saveState();
		const avatarsElems = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('avatar'), escapedEmail = escapeHtml(email);
		for (let i = 0; i < avatarsElems.length; i++) {
			if (avatarsElems[i].dataset.email === escapedEmail) {
				avatarsElems[i].innerHTML = '<img class="avatarImg" src="' + image + '">';
			}
		}
	}

	/* Refresh */
	public refresh(hard: boolean) {
		if (hard) {
			if (this.expandedCommit !== null) {
				this.expandedCommit = null;
				this.saveState();
			}
			this.renderShowLoading();
		}
		this.requestLoadBranchesAndCommits(hard);
	}

	/* Requests */
	private requestLoadBranches(hard: boolean, loadedCallback: (changes: boolean, isRepo: boolean) => void) {
		if (this.loadBranchesCallback !== null) return;
		this.loadBranchesCallback = loadedCallback;
		sendMessage({ command: 'loadBranches', repo: this.currentRepo!, showRemoteBranches: this.showRemoteBranches, hard: hard });
	}
	private requestLoadCommits(hard: boolean, loadedCallback: (changes: boolean) => void) {
		if (this.loadCommitsCallback !== null) return;
		this.loadCommitsCallback = loadedCallback;
		sendMessage({
			command: 'loadCommits',
			repo: this.currentRepo!,
			branchName: (this.currentBranch !== null ? this.currentBranch : ''),
			maxCommits: this.maxCommits,
			showRemoteBranches: this.showRemoteBranches,
			hard: hard
		});
	}
	private requestLoadBranchesAndCommits(hard: boolean) {
		this.requestLoadBranches(hard, (branchChanges: boolean, isRepo: boolean) => {
			if (isRepo) {
				this.requestLoadCommits(hard, (commitChanges: boolean) => {
					if (!hard && (branchChanges || commitChanges)) {
						hideDialogAndContextMenu();
					}
				});
			} else {
				sendMessage({ command: 'loadRepos', check: true });
			}
		});
	}
	private fetchAvatars(avatars: { [email: string]: string[] }) {
		const emails = Object.keys(avatars);
		for (let i = 0; i < emails.length; i++) {
			sendMessage({ command: 'fetchAvatar', repo: this.currentRepo!, email: emails[i], commits: avatars[emails[i]] });
		}
	}

	/* State */
	private saveState() {
		vscode.setState({
			gitRepos: this.gitRepos,
			gitBranches: this.gitBranches,
			gitBranchHead: this.gitBranchHead,
			gitRemotes: this.gitRemotes,
			commits: this.commits,
			commitHead: this.commitHead,
			avatars: this.avatars,
			currentBranch: this.currentBranch,
			currentRepo: this.currentRepo,
			moreCommitsAvailable: this.moreCommitsAvailable,
			maxCommits: this.maxCommits,
			showRemoteBranches: this.showRemoteBranches,
			expandedCommit: this.expandedCommit,
			fileViewType: this.fileViewType
		});
	}

	/* Renderers */
	private render() {
		this.renderTable();
		this.renderGraph();
	}
	private renderGraph() {
		const colHeadersElem = document.getElementById('tableColHeaders');
		if (colHeadersElem === null) return;
		const headerHeight = colHeadersElem.clientHeight + 1, expandedCommitElem = this.expandedCommit !== null ? document.getElementById('commitDetails') : null;
		this.config.grid.expandY = expandedCommitElem !== null ? expandedCommitElem.getBoundingClientRect().height : this.config.grid.expandY;
		this.config.grid.y = this.commits.length > 0 ? (this.tableElem.children[0].clientHeight - headerHeight - (this.expandedCommit !== null ? this.config.grid.expandY : 0)) / this.commits.length : this.config.grid.y;
		this.config.grid.offsetY = headerHeight + this.config.grid.y / 2;
		this.graph.render(this.expandedCommit);
	}
	private renderTable() {
		let html = '<tr id="tableColHeaders"><th id="tableHeaderGraphCol" class="tableColHeader">Graph</th><th class="tableColHeader">Description</th><th class="tableColHeader colDate">Date</th><th class="tableColHeader colAuthor">Author</th><th class="tableColHeader colCommit">Commit</th></tr>', i, currentHash = this.commits.length > 0 && this.commits[0].hash === '*' ? '*' : this.commitHead;
		const ancestorsOfHead = this.config.muteCommitsThatAreNotAncestorsOfHead ? this.getAncestorsOfHead() : null;
		for (i = 0; i < this.commits.length; i++) {
			let refs = '', message = escapeHtml(this.commits[i].message), date = getCommitDate(this.commits[i].date), j, refName, refActive, refHtml;
			for (j = 0; j < this.commits[i].refs.length; j++) {
				refName = escapeHtml(this.commits[i].refs[j].name);
				refActive = this.commits[i].refs[j].type === 'head' && this.commits[i].refs[j].name === this.gitBranchHead;
				refHtml = '<span class="gitRef ' + this.commits[i].refs[j].type + (refActive ? ' active' : '') + '" data-name="' + refName + '">' + (this.commits[i].refs[j].type === 'tag' ? svgIcons.tag : this.commits[i].refs[j].type === 'stash' ? svgIcons.stash : svgIcons.branch) + refName + '</span>';
				refs = refActive ? refHtml + refs : refs + refHtml;
			}
			const muted = this.commits[i].hash !== '*' && (
				(this.config.muteMergeCommits && this.commits[i].parentHashes.length > 1 && this.commits[i].stash === null) ||
				(ancestorsOfHead !== null && !ancestorsOfHead[this.commits[i].hash])
			);
			html += '<tr ' + (this.commits[i].hash !== '*' ? 'class="commit' + (muted ? ' mute' : '') + '" data-hash="' + this.commits[i].hash + '"' : 'class="unsavedChanges"') + ' data-id="' + i + '" data-color="' + this.graph.getVertexColour(i) + '"><td></td><td>' + (this.commits[i].hash === this.commitHead ? '<span class="commitHeadDot"></span>' : '') + refs + (this.commits[i].hash === currentHash ? '<b>' + message + '</b>' : message) + '</td><td class="colDate" title="' + date.title + '">' + date.value + '</td><td class="colAuthor" title="' + escapeHtml(this.commits[i].author + ' <' + this.commits[i].email + '>') + '">' + (this.config.fetchAvatars ? '<span class="avatar" data-email="' + escapeHtml(this.commits[i].email) + '">' + (typeof this.avatars[this.commits[i].email] === 'string' ? '<img class="avatarImg" src="' + this.avatars[this.commits[i].email] + '">' : '') + '</span>' : '') + escapeHtml(this.commits[i].author) + '</td><td class="colCommit" title="' + escapeHtml(this.commits[i].hash) + '">' + abbrevCommit(this.commits[i].hash) + '</td></tr>';
		}
		this.tableElem.innerHTML = '<table>' + html + '</table>';
		this.footerElem.innerHTML = this.moreCommitsAvailable ? '<div id="loadMoreCommitsBtn" class="roundedBtn">Load More Commits</div>' : '';
		this.makeTableResizable();
		this.findWidget.update();

		if (this.moreCommitsAvailable) {
			document.getElementById('loadMoreCommitsBtn')!.addEventListener('click', () => this.loadMoreCommits());
			if (this.config.loadMoreCommitsAutomatically) this.loadMoreCommitsIfScrolledToBottom();
		}

		if (this.expandedCommit !== null) {
			let elem = null, elems = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('commit');
			for (i = 0; i < elems.length; i++) {
				if (this.expandedCommit.hash === elems[i].dataset.hash) {
					elem = elems[i];
					break;
				}
			}
			if (elem === null) {
				this.expandedCommit = null;
				this.saveState();
			} else {
				this.expandedCommit.id = parseInt(elem.dataset.id!);
				this.expandedCommit.srcElem = elem;
				this.saveState();
				if (this.expandedCommit.commitDetails !== null && this.expandedCommit.fileTree !== null) {
					this.showCommitDetails(this.expandedCommit.commitDetails, this.expandedCommit.fileTree);
				} else {
					this.loadCommitDetails(elem);
				}
			}
		}

	}
	/**
	 * Register the listeners for commit rows and reference labels once, on the table container. The
	 * table is re-rendered on every refresh, so per-row listeners would have to be re-attached each
	 * time, which is slow for thousands of rows.
	 */
	private registerTableListeners() {
		addDelegatedListener(this.tableElem, 'commit', 'contextmenu', (e: Event) => {
			if ((<Element>e.target).closest('.gitRef') !== null) return; // Handled by the reference listener
			e.stopPropagation();
			const sourceElem = <HTMLElement>(<Element>e.target).closest('.commit')!;
			const hash = sourceElem.dataset.hash!, visibility = this.config.contextMenuActionsVisibility.commit;
			const stash = this.commits[this.commitLookup[hash]].stash;
			if (stash !== null) {
				this.showStashContextMenu(<MouseEvent>e, hash, stash, sourceElem);
				return;
			}
			showContextMenu(<MouseEvent>e, [
				{
					title: 'Add Tag' + ELLIPSIS,
					visible: visibility.addTag,
					onClick: () => {
						showFormDialog('Add tag to commit <b><i>' + abbrevCommit(hash) + '</i></b>:', [
							{ type: 'text-ref' as const, name: 'Name: ', default: '' },
							{ type: 'select' as const, name: 'Type: ', default: this.config.dialogDefaults.addTag.type, options: [{ name: 'Annotated', value: 'annotated' }, { name: 'Lightweight', value: 'lightweight' }] },
							{ type: 'text' as const, name: 'Message: ', default: '', placeholder: 'Optional' }
						], 'Add Tag', values => {
							sendMessage({ command: 'addTag', repo: this.currentRepo!, tagName: values[0], commitHash: hash, lightweight: values[1] === 'lightweight', message: values[2] });
						}, sourceElem);
					}
				},
				{
					title: 'Create Branch' + ELLIPSIS,
					visible: visibility.createBranch,
					onClick: () => {
						showFormDialog('Enter the name of the branch you would like to create from commit <b><i>' + abbrevCommit(hash) + '</i></b>:', [
							{ type: 'text-ref', name: 'Name: ', default: '' },
							{ type: 'checkbox', name: 'Check out', value: this.config.dialogDefaults.createBranch.checkOut }
						], 'Create Branch', (values) => {
							sendMessage({ command: 'createBranch', repo: this.currentRepo!, branchName: values[0], commitHash: hash, checkout: values[1] === 'checked' });
						}, sourceElem);
					}
				},
				null,
				{
					title: 'Checkout' + ELLIPSIS,
					visible: visibility.checkout,
					onClick: () => {
						showConfirmationDialog('Are you sure you want to checkout commit <b><i>' + abbrevCommit(hash) + '</i></b>? This will result in a \'detached HEAD\' state.', () => {
							sendMessage({ command: 'checkoutCommit', repo: this.currentRepo!, commitHash: hash });
						}, sourceElem);
					}
				},
				{
					title: 'Cherry Pick' + ELLIPSIS,
					visible: visibility.cherrypick,
					onClick: () => {
						const isMerge = this.commits[this.commitLookup[hash]].parentHashes.length > 1;
						const inputs: DialogInput[] = [
							{ type: 'checkbox', name: 'Record Origin (add "cherry picked from commit" to the message)', value: this.config.dialogDefaults.cherryPick.recordOrigin },
							{ type: 'checkbox', name: 'No Commit (stage the changes only)', value: this.config.dialogDefaults.cherryPick.noCommit }
						];
						if (isMerge) {
							inputs.unshift({
								type: 'select', name: 'Parent: ', default: '1',
								options: this.commits[this.commitLookup[hash]].parentHashes.map((hash, index) => ({
									name: abbrevCommit(hash) + (typeof this.commitLookup[hash] === 'number' ? ': ' + this.commits[this.commitLookup[hash]].message : ''),
									value: (index + 1).toString()
								}))
							});
						}
						showFormDialog('Are you sure you want to cherry pick ' + (isMerge ? 'merge commit <b><i>' + abbrevCommit(hash) + '</i></b>? Choose the parent on the main branch, to cherry pick the commit relative to:' : 'commit <b><i>' + abbrevCommit(hash) + '</i></b>?'), inputs, 'Yes, cherry pick', (values) => {
							const parentIndex = isMerge ? parseInt(values.shift()!) : 0;
							sendMessage({ command: 'cherrypickCommit', repo: this.currentRepo!, commitHash: hash, parentIndex: parentIndex, recordOrigin: values[0] === 'checked', noCommit: values[1] === 'checked' });
						}, sourceElem);
					}
				},
				{
					title: 'Revert' + ELLIPSIS,
					visible: visibility.revert,
					onClick: () => {
						if (this.commits[this.commitLookup[hash]].parentHashes.length === 1) {
							showConfirmationDialog('Are you sure you want to revert commit <b><i>' + abbrevCommit(hash) + '</i></b>?', () => {
								sendMessage({ command: 'revertCommit', repo: this.currentRepo!, commitHash: hash, parentIndex: 0 });
							}, sourceElem);
						} else {
							const options = this.commits[this.commitLookup[hash]].parentHashes.map((hash, index) => ({
								name: abbrevCommit(hash) + (typeof this.commitLookup[hash] === 'number' ? ': ' + this.commits[this.commitLookup[hash]].message : ''),
								value: (index + 1).toString()
							}));
							showSelectDialog('Are you sure you want to revert merge commit <b><i>' + abbrevCommit(hash) + '</i></b>? Choose the parent hash on the main branch, to revert the commit relative to:', '1', options, 'Yes, revert commit', (parentIndex) => {
								sendMessage({ command: 'revertCommit', repo: this.currentRepo!, commitHash: hash, parentIndex: parseInt(parentIndex) });
							}, sourceElem);
						}
					}
				},
				{
					title: 'Drop Commit' + ELLIPSIS,
					visible: visibility.drop && this.commits[this.commitLookup[hash]].parentHashes.length === 1,
					onClick: () => {
						showConfirmationDialog('Are you sure you want to drop commit <b><i>' + abbrevCommit(hash) + '</i></b>? The commits after it on the current branch are rewritten.', () => {
							showActionRunningDialog('Dropping Commit');
							sendMessage({ command: 'dropCommit', repo: this.currentRepo!, commitHash: hash });
						}, sourceElem);
					}
				},
				null,
				{
					title: 'Merge into current branch' + ELLIPSIS,
					visible: visibility.merge,
					onClick: () => {
						this.showMergeDialog('Are you sure you want to merge commit <b><i>' + abbrevCommit(hash) + '</i></b> into the current branch?', (options) => {
							sendMessage({ command: 'mergeCommit', repo: this.currentRepo!, commitHash: hash, ...options });
						});
					}
				},
				{
					title: 'Rebase current branch on this Commit' + ELLIPSIS,
					visible: visibility.rebase,
					onClick: () => {
						showCheckboxDialog('Are you sure you want to rebase the <b>current branch</b> on commit <b><i>' + abbrevCommit(hash) + '</i></b>?', 'Ignore Date (non-interactive rebase only)', this.config.dialogDefaults.rebase.ignoreDate, 'Yes, rebase', (ignoreDate) => {
							showActionRunningDialog('Rebasing');
							sendMessage({ command: 'rebase', repo: this.currentRepo!, obj: hash, type: 'Commit', ignoreDate: ignoreDate });
						}, sourceElem);
					}
				},
				{
					title: 'Reset current branch to this Commit' + ELLIPSIS,
					visible: visibility.reset,
					onClick: () => {
						showSelectDialog('Are you sure you want to reset the <b>current branch</b> to commit <b><i>' + abbrevCommit(hash) + '</i></b>?', this.config.dialogDefaults.resetCurrentBranchToCommit.mode, [
							{ name: 'Soft - Keep all changes, but reset head', value: 'soft' },
							{ name: 'Mixed - Keep working tree, but reset index', value: 'mixed' },
							{ name: 'Hard - Discard all changes', value: 'hard' }
						], 'Yes, reset', (mode) => {
							sendMessage({ command: 'resetToCommit', repo: this.currentRepo!, commitHash: hash, resetMode: <GG.GitResetMode>mode });
						}, sourceElem);
					}
				},
				null,
				{
					title: 'Copy Commit Hash to Clipboard',
					visible: visibility.copyHash,
					onClick: () => {
						sendMessage({ command: 'copyToClipboard', type: 'Commit Hash', data: hash });
					}
				}
			], sourceElem);
		});
		addDelegatedListener(this.tableElem, 'commit', 'click', (e: Event) => {
			if ((<Element>e.target).closest('.gitRef') !== null) return; // Handled by the reference listener
			const sourceElem = <HTMLElement>(<Element>e.target).closest('.commit')!;
			if (this.expandedCommit !== null && this.expandedCommit.hash === sourceElem.dataset.hash!) {
				this.hideCommitDetails();
			} else {
				this.loadCommitDetails(sourceElem);
			}
		});
		addDelegatedListener(this.tableElem, 'unsavedChanges', 'contextmenu', (e: Event) => {
			e.stopPropagation();
			const sourceElem = <HTMLElement>(<Element>e.target).closest('.unsavedChanges')!, visibility = this.config.contextMenuActionsVisibility.uncommittedChanges;
			showContextMenu(<MouseEvent>e, [
				{
					title: 'Stash uncommitted changes' + ELLIPSIS,
					visible: visibility.stash,
					onClick: () => {
						showFormDialog('Stash the <b>uncommitted changes</b>:', [
							{ type: 'text', name: 'Message: ', default: '', placeholder: 'Optional' },
							{ type: 'checkbox', name: 'Include Untracked', value: this.config.dialogDefaults.stashUncommittedChanges.includeUntracked }
						], 'Yes, stash', (values) => {
							sendMessage({ command: 'pushStash', repo: this.currentRepo!, message: values[0], includeUntracked: values[1] === 'checked' });
						}, sourceElem);
					}
				},
				{
					title: 'Reset uncommitted changes' + ELLIPSIS,
					visible: visibility.reset,
					onClick: () => {
						showSelectDialog('Are you sure you want to reset the <b>uncommitted changes</b>?', this.config.dialogDefaults.resetUncommittedChanges.mode, [
							{ name: 'Mixed - Keep working tree, but reset index', value: 'mixed' },
							{ name: 'Hard - Discard all changes', value: 'hard' }
						], 'Yes, reset', (mode) => {
							sendMessage({ command: 'resetUncommittedChanges', repo: this.currentRepo!, mode: <'mixed' | 'hard'>mode });
						}, sourceElem);
					}
				},
				{
					title: 'Clean untracked files' + ELLIPSIS,
					visible: visibility.clean,
					onClick: () => {
						showCheckboxDialog('Are you sure you want to delete all <b>untracked files</b>? This cannot be undone.', 'Also delete untracked directories', false, 'Yes, clean', (directories) => {
							sendMessage({ command: 'cleanUntrackedFiles', repo: this.currentRepo!, directories: directories });
						}, sourceElem);
					}
				}
			], sourceElem);
		});
		addDelegatedListener(this.tableElem, 'gitRef', 'contextmenu', (e: Event) => {
			e.stopPropagation();
			const sourceElem = <HTMLElement>(<Element>e.target).closest('.gitRef')!;
			let refName = unescapeHtml(sourceElem.dataset.name!), menu: ContextMenuElement[], copyType: string;
			if (sourceElem.classList.contains('stash')) {
				const row = <HTMLElement>sourceElem.closest('.commit')!, hash = row.dataset.hash!;
				this.showStashContextMenu(<MouseEvent>e, hash, this.commits[this.commitLookup[hash]].stash!, row);
				return;
			}
			if (sourceElem.classList.contains('tag')) {
				menu = [{
					title: 'Delete Tag' + ELLIPSIS,
					visible: this.config.contextMenuActionsVisibility.tag.delete,
					onClick: () => {
						showConfirmationDialog('Are you sure you want to delete the tag <b><i>' + escapeHtml(refName) + '</i></b>?', () => {
							sendMessage({ command: 'deleteTag', repo: this.currentRepo!, tagName: refName });
						}, null);
					}
				}, {
					title: 'Push Tag' + ELLIPSIS,
					visible: this.config.contextMenuActionsVisibility.tag.push,
					onClick: () => {
						showConfirmationDialog('Are you sure you want to push the tag <b><i>' + escapeHtml(refName) + '</i></b>?', () => {
							sendMessage({ command: 'pushTag', repo: this.currentRepo!, tagName: refName });
							showActionRunningDialog('Pushing Tag');
						}, null);
					}
				}];
				copyType = 'Tag Name';
			} else {
				if (sourceElem.classList.contains('head')) {
					menu = [];
					if (this.gitBranchHead !== refName) {
						menu.push({
							title: 'Checkout Branch',
							visible: this.config.contextMenuActionsVisibility.branch.checkout,
							onClick: () => this.checkoutBranchAction(sourceElem, refName)
						});
					}
					menu.push({
						title: 'Rename Branch' + ELLIPSIS,
						visible: this.config.contextMenuActionsVisibility.branch.rename,
						onClick: () => {
							showRefInputDialog('Enter the new name for branch <b><i>' + escapeHtml(refName) + '</i></b>:', refName, 'Rename Branch', (newName) => {
								sendMessage({ command: 'renameBranch', repo: this.currentRepo!, oldName: refName, newName: newName });
							}, null);
						}
					});
					if (this.gitBranchHead !== refName) {
						menu.push(
							{
								title: 'Delete Branch' + ELLIPSIS,
								visible: this.config.contextMenuActionsVisibility.branch.delete,
								onClick: () => {
									showCheckboxDialog('Are you sure you want to delete the branch <b><i>' + escapeHtml(refName) + '</i></b>?', 'Force Delete', this.config.dialogDefaults.deleteBranch.forceDelete, 'Delete Branch', (forceDelete) => {
										sendMessage({ command: 'deleteBranch', repo: this.currentRepo!, branchName: refName, forceDelete: forceDelete });
									}, null);
								}
							}, {
								title: 'Merge into current branch' + ELLIPSIS,
								visible: this.config.contextMenuActionsVisibility.branch.merge,
								onClick: () => {
									this.showMergeDialog('Are you sure you want to merge branch <b><i>' + escapeHtml(refName) + '</i></b> into the current branch?', (options) => {
										sendMessage({ command: 'mergeBranch', repo: this.currentRepo!, branchName: refName, ...options });
									});
								}
							}
						);
					}
					if (this.gitBranchHead !== refName) {
						menu.push({
							title: 'Rebase current branch on this branch' + ELLIPSIS,
							visible: this.config.contextMenuActionsVisibility.branch.rebase,
							onClick: () => {
								showCheckboxDialog('Are you sure you want to rebase the <b>current branch</b> on branch <b><i>' + escapeHtml(refName) + '</i></b>?', 'Ignore Date (non-interactive rebase only)', this.config.dialogDefaults.rebase.ignoreDate, 'Yes, rebase', (ignoreDate) => {
									showActionRunningDialog('Rebasing');
									sendMessage({ command: 'rebase', repo: this.currentRepo!, obj: refName, type: 'Branch', ignoreDate: ignoreDate });
								}, null);
							}
						});
					}
					if (this.gitRemotes.length > 0) {
						menu.push({
							title: 'Push Branch' + ELLIPSIS,
							visible: this.config.contextMenuActionsVisibility.branch.push,
							onClick: () => {
								const inputs: DialogInput[] = [
									{ type: 'checkbox', name: 'Set Upstream', value: true },
									{ type: 'select', name: 'Mode: ', default: 'normal', options: [{ name: 'Normal', value: 'normal' }, { name: 'Force With Lease', value: 'force-with-lease' }, { name: 'Force', value: 'force' }] }
								];
								if (this.gitRemotes.length > 1) {
									inputs.unshift({ type: 'select', name: 'Remote: ', default: this.gitRemotes.indexOf('origin') > -1 ? 'origin' : this.gitRemotes[0], options: this.gitRemotes.map((remote) => ({ name: remote, value: remote })) });
								}
								showFormDialog('Are you sure you want to push the branch <b><i>' + escapeHtml(refName) + '</i></b>' + (this.gitRemotes.length === 1 ? ' to the remote <b><i>' + escapeHtml(this.gitRemotes[0]) + '</i></b>' : '') + '?', inputs, 'Yes, push', (values) => {
									const remote = this.gitRemotes.length > 1 ? values.shift()! : this.gitRemotes[0];
									showActionRunningDialog('Pushing Branch');
									sendMessage({ command: 'pushBranch', repo: this.currentRepo!, branchName: refName, remote: remote, setUpstream: values[0] === 'checked', mode: <GG.GitPushBranchMode>values[1] });
								}, null);
							}
						});
					}
				} else {
					const remote = this.getRemoteOfBranch(refName), remoteBranch = remote !== null ? refName.substring(remote.length + 1) : refName;
					menu = [{
						title: 'Checkout Branch' + ELLIPSIS,
						visible: this.config.contextMenuActionsVisibility.remoteBranch.checkout,
						onClick: () => this.checkoutBranchAction(sourceElem, refName)
					}];
					if (remote !== null) {
						menu.push({
							title: 'Delete Remote Branch' + ELLIPSIS,
							visible: this.config.contextMenuActionsVisibility.remoteBranch.delete,
							onClick: () => {
								showConfirmationDialog('Are you sure you want to delete the remote branch <b><i>' + escapeHtml(refName) + '</i></b>? This removes the branch from the remote <b><i>' + escapeHtml(remote) + '</i></b>.', () => {
									showActionRunningDialog('Deleting Remote Branch');
									sendMessage({ command: 'deleteRemoteBranch', repo: this.currentRepo!, branchName: remoteBranch, remote: remote });
								}, null);
							}
						}, {
							title: 'Fetch into local branch' + ELLIPSIS,
							visible: this.config.contextMenuActionsVisibility.remoteBranch.fetch,
							onClick: () => {
								showFormDialog('Fetch the remote branch <b><i>' + escapeHtml(refName) + '</i></b> into a local branch (the local branch must not be checked out):', [
									{ type: 'text-ref', name: 'Local branch: ', default: remoteBranch },
									{ type: 'checkbox', name: 'Force Fetch', value: this.config.dialogDefaults.fetchIntoLocalBranch.forceFetch }
								], 'Yes, fetch', (values) => {
									showActionRunningDialog('Fetching Branch');
									sendMessage({ command: 'fetchIntoLocalBranch', repo: this.currentRepo!, remote: remote, remoteBranch: remoteBranch, localBranch: values[0], force: values[1] === 'checked' });
								}, null);
							}
						}, {
							title: 'Pull into current branch' + ELLIPSIS,
							visible: this.config.contextMenuActionsVisibility.remoteBranch.pull,
							onClick: () => {
								showFormDialog('Are you sure you want to pull the remote branch <b><i>' + escapeHtml(refName) + '</i></b> into the current branch?', [
									{ type: 'checkbox', name: 'Create a new commit even if fast-forward is possible', value: this.config.dialogDefaults.pullBranch.noFastForward },
									{ type: 'checkbox', name: 'Squash Commits', value: this.config.dialogDefaults.pullBranch.squashCommits }
								], 'Yes, pull', (values) => {
									showActionRunningDialog('Pulling Branch');
									sendMessage({ command: 'pullBranch', repo: this.currentRepo!, branchName: remoteBranch, remote: remote, createNewCommit: values[0] === 'checked', squash: values[1] === 'checked' });
								}, null);
							}
						});
					}
				}
				copyType = 'Branch Name';
			}
			menu.push(null, {
				title: 'Copy ' + copyType + ' to Clipboard',
				visible: sourceElem.classList.contains('tag') ? this.config.contextMenuActionsVisibility.tag.copyName : sourceElem.classList.contains('head') ? this.config.contextMenuActionsVisibility.branch.copyName : this.config.contextMenuActionsVisibility.remoteBranch.copyName,
				onClick: () => {
					sendMessage({ command: 'copyToClipboard', type: copyType, data: refName });
				}
			});
			showContextMenu(<MouseEvent>e, menu, sourceElem);
		});
		addDelegatedListener(this.tableElem, 'gitRef', 'click', (e: Event) => e.stopPropagation());
		addDelegatedListener(this.tableElem, 'gitRef', 'dblclick', (e: Event) => {
			e.stopPropagation();
			hideDialogAndContextMenu();
			const sourceElem = <HTMLElement>(<Element>e.target).closest('.gitRef')!;
			if (sourceElem.classList.contains('stash') || sourceElem.classList.contains('tag')) return;
			this.checkoutBranchAction(sourceElem, unescapeHtml(sourceElem.dataset.name!));
		});
	}
	private renderUncommitedChanges() {
		const date = getCommitDate(this.commits[0].date);
		document.getElementsByClassName('unsavedChanges')[0].innerHTML = '<td></td><td><b>' + escapeHtml(this.commits[0].message) + '</b></td><td class="colDate" title="' + date.title + '">' + date.value + '</td><td class="colAuthor" title="* <>">*</td><td class="colCommit" title="*">*</td>';
	}
	private renderShowLoading() {
		hideDialogAndContextMenu();
		this.graph.clear();
		this.tableElem.innerHTML = '<h2 id="loadingHeader">' + svgIcons.loading + 'Loading ...</h2>';
		this.footerElem.innerHTML = '';
	}
	/** Context menu of a stash row or label. */
	private showStashContextMenu(e: MouseEvent, hash: string, stash: GG.GitStash, sourceElem: HTMLElement) {
		const visibility = this.config.contextMenuActionsVisibility.stash, name = stash.selector;
		showContextMenu(e, [
			{
				title: 'Apply Stash' + ELLIPSIS,
				visible: visibility.apply,
				onClick: () => {
					showCheckboxDialog('Are you sure you want to apply the stash <b><i>' + escapeHtml(name) + '</i></b>?', 'Reinstate Index', this.config.dialogDefaults.applyStash.reinstateIndex, 'Yes, apply', (reinstateIndex) => {
						sendMessage({ command: 'applyStash', repo: this.currentRepo!, selector: name, reinstateIndex: reinstateIndex });
					}, sourceElem);
				}
			},
			{
				title: 'Create Branch from Stash' + ELLIPSIS,
				visible: visibility.createBranch,
				onClick: () => {
					showRefInputDialog('Enter the name of the branch you would like to create from the stash <b><i>' + escapeHtml(name) + '</i></b>:', '', 'Create Branch', (branchName) => {
						sendMessage({ command: 'branchFromStash', repo: this.currentRepo!, selector: name, branchName: branchName });
					}, sourceElem);
				}
			},
			{
				title: 'Pop Stash' + ELLIPSIS,
				visible: visibility.pop,
				onClick: () => {
					showCheckboxDialog('Are you sure you want to pop the stash <b><i>' + escapeHtml(name) + '</i></b>?', 'Reinstate Index', this.config.dialogDefaults.popStash.reinstateIndex, 'Yes, pop', (reinstateIndex) => {
						sendMessage({ command: 'popStash', repo: this.currentRepo!, selector: name, reinstateIndex: reinstateIndex });
					}, sourceElem);
				}
			},
			{
				title: 'Drop Stash' + ELLIPSIS,
				visible: visibility.drop,
				onClick: () => {
					showConfirmationDialog('Are you sure you want to drop the stash <b><i>' + escapeHtml(name) + '</i></b>?', () => {
						sendMessage({ command: 'dropStash', repo: this.currentRepo!, selector: name });
					}, sourceElem);
				}
			},
			null,
			{
				title: 'Copy Stash Name to Clipboard',
				visible: visibility.copyName,
				onClick: () => sendMessage({ command: 'copyToClipboard', type: 'Stash Name', data: name })
			},
			{
				title: 'Copy Stash Hash to Clipboard',
				visible: visibility.copyHash,
				onClick: () => sendMessage({ command: 'copyToClipboard', type: 'Stash Hash', data: hash })
			}
		], sourceElem);
	}
	/** Merge dialog shared by the commit and branch menus: no-fast-forward, squash and no-commit options. */
	private showMergeDialog(message: string, actioned: (options: GG.MergeOptions) => void) {
		showFormDialog(message, [
			{ type: 'checkbox', name: 'Create a new commit even if fast-forward is possible', value: this.config.dialogDefaults.merge.noFastForward },
			{ type: 'checkbox', name: 'Squash Commits', value: this.config.dialogDefaults.merge.squashCommits },
			{ type: 'checkbox', name: 'No Commit (stage the merge only)', value: this.config.dialogDefaults.merge.noCommit }
		], 'Yes, merge', (values) => {
			actioned({ createNewCommit: values[0] === 'checked', squash: values[1] === 'checked', noCommit: values[2] === 'checked' });
		}, null);
	}
	/** The remote that a remote branch name such as "origin/feature" belongs to, or null when none matches. */
	private getRemoteOfBranch(remoteBranchName: string) {
		let match: string | null = null;
		for (let i = 0; i < this.gitRemotes.length; i++) {
			if (remoteBranchName.startsWith(this.gitRemotes[i] + '/') && (match === null || this.gitRemotes[i].length > match.length)) {
				match = this.gitRemotes[i];
			}
		}
		return match;
	}
	private checkoutBranchAction(sourceElem: HTMLElement, refName: string) {
		if (sourceElem.classList.contains('head')) {
			sendMessage({ command: 'checkoutBranch', repo: this.currentRepo!, branchName: refName, remoteBranch: null });
		} else if (sourceElem.classList.contains('remote')) {
			const refNameComps = refName.split('/');
			showRefInputDialog('Enter the name of the new branch you would like to create when checking out <b><i>' + escapeHtml(sourceElem.dataset.name!) + '</i></b>:', refNameComps[refNameComps.length - 1], 'Checkout Branch', (newBranch) => {
				sendMessage({ command: 'checkoutBranch', repo: this.currentRepo!, branchName: newBranch, remoteBranch: refName });
			}, null);
		}
	}
	private makeTableResizable() {
		const colHeadersElem = document.getElementById('tableColHeaders')!, cols = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('tableColHeader');
		const visibility = this.getColumnVisibility(), columnClasses = ' ' + getColumnVisibilityClasses(visibility);
		// Columns: 0 graph, 1 description (flexible), 2 date, 3 author, 4 commit. columnWidths holds the widths of columns 0, 2, 3 and 4.
		const visibleCols = [0, 1, 2, 3, 4].filter((c) => c < 2 || (c === 2 ? visibility.date : c === 3 ? visibility.author : visibility.commit));
		const widthIndex = (c: number) => c === 0 ? 0 : c - 1;
		let columnWidths = this.gitRepos[this.currentRepo].columnWidths, mouseX = -1, leftCol = -1, rightCol = -1, that = this;

		// Resize handles sit on the boundaries between consecutive visible columns
		for (let i = 1; i < visibleCols.length; i++) {
			const left = visibleCols[i - 1], right = visibleCols[i];
			cols[left].innerHTML += '<span class="resizeCol right" data-left="' + left + '" data-right="' + right + '"></span>';
			cols[right].innerHTML += '<span class="resizeCol left" data-left="' + left + '" data-right="' + right + '"></span>';
		}
		if (columnWidths !== null) {
			makeTableFixedLayout();
		} else {
			this.tableElem.className = 'autoLayout' + columnClasses;
			this.graph.limitMaxWidth(-1);
			cols[0].style.padding = '0 ' + Math.round((Math.max(this.graph.getWidth() + 16, 64) - (cols[0].offsetWidth - 24)) / 2) + 'px';
		}

		addListenerToClass('resizeCol', 'mousedown', (e) => {
			leftCol = parseInt((<HTMLElement>e.target).dataset.left!);
			rightCol = parseInt((<HTMLElement>e.target).dataset.right!);
			mouseX = (<MouseEvent>e).clientX;
			if (columnWidths === null) {
				columnWidths = [0, 2, 3, 4].map((c) => visibleCols.indexOf(c) > -1 ? cols[c].clientWidth - 24 : 100);
				makeTableFixedLayout();
			}
			colHeadersElem.classList.add('resizing');
		});
		colHeadersElem.addEventListener('mousemove', (e) => {
			if (leftCol > -1 && columnWidths !== null) {
				const mouseEvent = <MouseEvent>e;
				let mouseDeltaX = mouseEvent.clientX - mouseX;
				if (leftCol === 0) {
					// Graph column against the flexible description column
					if (columnWidths[0] + mouseDeltaX < 40) mouseDeltaX = -columnWidths[0] + 40;
					if (cols[1].clientWidth - mouseDeltaX < 64) mouseDeltaX = cols[1].clientWidth - 64;
					columnWidths[0] += mouseDeltaX;
					cols[0].style.width = columnWidths[0] + 'px';
					this.graph.limitMaxWidth(columnWidths[0] + 16);
				} else if (leftCol === 1) {
					// Flexible description column against the first visible fixed column to its right
					const r = widthIndex(rightCol);
					if (cols[1].clientWidth + mouseDeltaX < 64) mouseDeltaX = -cols[1].clientWidth + 64;
					if (columnWidths[r] - mouseDeltaX < 40) mouseDeltaX = columnWidths[r] - 40;
					columnWidths[r] -= mouseDeltaX;
					cols[rightCol].style.width = columnWidths[r] + 'px';
				} else {
					// Two fixed columns: move width from one to the other
					const l = widthIndex(leftCol), r = widthIndex(rightCol);
					if (columnWidths[l] + mouseDeltaX < 40) mouseDeltaX = -columnWidths[l] + 40;
					if (columnWidths[r] - mouseDeltaX < 40) mouseDeltaX = columnWidths[r] - 40;
					columnWidths[l] += mouseDeltaX;
					columnWidths[r] -= mouseDeltaX;
					cols[leftCol].style.width = columnWidths[l] + 'px';
					cols[rightCol].style.width = columnWidths[r] + 'px';
				}
				mouseX = mouseEvent.clientX;
			}
		});
		colHeadersElem.addEventListener('mouseup', stopResizing);
		colHeadersElem.addEventListener('mouseleave', stopResizing);
		colHeadersElem.addEventListener('contextmenu', (e) => {
			e.stopPropagation();
			const current = this.getColumnVisibility();
			const toggle = (column: keyof GG.ColumnVisibility) => {
				const next = { ...current, [column]: !current[column] };
				this.gitRepos[this.currentRepo].columnVisibility = next;
				sendMessage({ command: 'saveRepoState', repo: this.currentRepo, state: this.gitRepos[this.currentRepo] });
				this.render();
			};
			showContextMenu(e, [
				{ title: (current.date ? '\u2713 ' : '\u2003 ') + 'Date', onClick: () => toggle('date') },
				{ title: (current.author ? '\u2713 ' : '\u2003 ') + 'Author', onClick: () => toggle('author') },
				{ title: (current.commit ? '\u2713 ' : '\u2003 ') + 'Commit', onClick: () => toggle('commit') }
			], colHeadersElem);
		});
		function stopResizing() {
			if (leftCol > -1 && columnWidths !== null) {
				leftCol = -1;
				rightCol = -1;
				mouseX = -1;
				colHeadersElem.classList.remove('resizing');
				that.gitRepos[that.currentRepo].columnWidths = columnWidths;
				sendMessage({ command: 'saveRepoState', repo: that.currentRepo, state: that.gitRepos[that.currentRepo] });
			}
		}
		function makeTableFixedLayout() {
			if (columnWidths !== null) {
				cols[0].style.width = columnWidths[0] + 'px';
				cols[0].style.padding = '';
				cols[2].style.width = columnWidths[1] + 'px';
				cols[3].style.width = columnWidths[2] + 'px';
				cols[4].style.width = columnWidths[3] + 'px';
				that.tableElem.className = 'fixedLayout' + columnClasses;
				that.graph.limitMaxWidth(columnWidths[0] + 16);
			}
		}
	}

	/** Column visibility of the current repository: its own override, or the default from the settings. */
	private getColumnVisibility(): GG.ColumnVisibility {
		const override = this.gitRepos[this.currentRepo].columnVisibility;
		return override ? override : this.config.defaultColumnVisibility;
	}

	/** Hashes of the commits that are ancestors of the checked-out commit (including itself), among the loaded commits. */
	private getAncestorsOfHead() {
		const ancestors: { [hash: string]: true } = {};
		if (this.commitHead === null || typeof this.commitLookup[this.commitHead] !== 'number') return ancestors;
		const queue = [this.commitHead];
		ancestors[this.commitHead] = true;
		while (queue.length > 0) {
			const commit = this.commits[this.commitLookup[queue.pop()!]];
			for (let i = 0; i < commit.parentHashes.length; i++) {
				const parent = commit.parentHashes[i];
				if (!ancestors[parent] && typeof this.commitLookup[parent] === 'number') {
					ancestors[parent] = true;
					queue.push(parent);
				}
			}
		}
		return ancestors;
	}

	/* Scrolling */
	private scrollToHead() {
		if (this.commitHead === null || typeof this.commitLookup[this.commitHead] !== 'number') return;
		this.scrollToRow(this.commitLookup[this.commitHead]);
	}
	/** Scroll to the next (delta 1) or previous (delta -1) stash, cycling through them. */
	private scrollToStash(delta: number) {
		const stashRows: number[] = [];
		for (let i = 0; i < this.commits.length; i++) {
			if (this.commits[i].stash !== null) stashRows.push(i);
		}
		if (stashRows.length === 0) return;
		let position = stashRows.indexOf(this.lastStashScrolledTo);
		position = position === -1 ? (delta > 0 ? 0 : stashRows.length - 1) : (position + delta + stashRows.length) % stashRows.length;
		this.lastStashScrolledTo = stashRows[position];
		this.scrollToRow(this.lastStashScrolledTo);
	}
	private scrollToRow(id: number) {
		const row = <HTMLElement | null>this.tableElem.querySelector('tr[data-id="' + id + '"]');
		if (row !== null) row.scrollIntoView({ block: 'center' });
	}

	/* Observers */
	private observeWindowSizeChanges() {
		let windowWidth = window.outerWidth, windowHeight = window.outerHeight;
		window.addEventListener('resize', () => {
			if (windowWidth === window.outerWidth && windowHeight === window.outerHeight) {
				this.renderGraph();
			} else {
				windowWidth = window.outerWidth;
				windowHeight = window.outerHeight;
			}
		});
	}
	private observeWebviewStyleChanges() {
		let fontFamily = getVSCodeStyle('--vscode-editor-font-family');
		(new MutationObserver(() => {
			const ff = getVSCodeStyle('--vscode-editor-font-family');
			if (ff !== fontFamily) {
				fontFamily = ff;
				this.repoDropdown.refresh();
				this.branchDropdown.refresh();
			}
		})).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
	}
	private observeWebviewScroll() {
		let active = window.scrollY > 0;
		this.scrollShadowElem.className = active ? 'active' : '';
		document.addEventListener('scroll', () => {
			if (active !== window.scrollY > 0) {
				active = window.scrollY > 0;
				this.scrollShadowElem.className = active ? 'active' : '';
			}
			if (this.config.loadMoreCommitsAutomatically) this.loadMoreCommitsIfScrolledToBottom();
		});
	}

	/* Load More Commits */
	private loadMoreCommits() {
		const btn = document.getElementById('loadMoreCommitsBtn');
		if (btn === null) return; // Already loading
		(<HTMLElement>btn.parentNode!).innerHTML = '<h2 id="loadingHeader">' + svgIcons.loading + 'Loading ...</h2>';
		this.maxCommits += this.config.loadMoreCommits;
		this.hideCommitDetails();
		this.saveState();
		this.requestLoadCommits(true, () => { });
	}
	private loadMoreCommitsIfScrolledToBottom() {
		if (!this.moreCommitsAvailable || this.loadCommitsCallback !== null) return;
		// Within one row of the end of the document, or the document is shorter than the window
		if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - this.config.grid.y) {
			this.loadMoreCommits();
		}
	}

	/* Commit Details */
	private loadCommitDetails(sourceElem: HTMLElement) {
		this.hideCommitDetails();
		this.expandedCommit = { id: parseInt(sourceElem.dataset.id!), hash: sourceElem.dataset.hash!, srcElem: sourceElem, commitDetails: null, fileTree: null };
		this.saveState();
		sendMessage({ command: 'commitDetails', repo: this.currentRepo!, commitHash: sourceElem.dataset.hash! });
	}
	public hideCommitDetails() {
		if (this.expandedCommit !== null) {
			const elem = document.getElementById('commitDetails');
			if (typeof elem === 'object' && elem !== null) elem.remove();
			if (typeof this.expandedCommit.srcElem === 'object' && this.expandedCommit.srcElem !== null) this.expandedCommit.srcElem.classList.remove('commitDetailsOpen');
			this.expandedCommit = null;
			this.saveState();
			this.renderGraph();
		}
	}
	public showCommitDetails(commitDetails: GG.GitCommitDetails, fileTree: GitFolder) {
		if (this.expandedCommit === null || this.expandedCommit.srcElem === null || this.expandedCommit.hash !== commitDetails.hash) return;
		const elem = document.getElementById('commitDetails');
		if (typeof elem === 'object' && elem !== null) elem.remove();

		this.expandedCommit.commitDetails = commitDetails;
		this.expandedCommit.fileTree = fileTree;
		this.expandedCommit.srcElem.classList.add('commitDetailsOpen');
		this.saveState();

		let newElem = document.createElement('tr'), html = '<td></td><td colspan="4"><div id="commitDetailsSummary">';
		html += '<span class="commitDetailsSummaryTop' + (typeof this.avatars[commitDetails.email] === 'string' ? ' withAvatar' : '') + '"><span class="commitDetailsSummaryTopRow"><span class="commitDetailsSummaryKeyValues">';
		html += '<b>Commit: </b>' + escapeHtml(commitDetails.hash) + '<br>';
		html += '<b>Parents: </b>' + commitDetails.parents.join(', ') + '<br>';
		html += '<b>Author: </b>' + escapeHtml(commitDetails.author) + ' &lt;<a href="mailto:' + encodeURIComponent(commitDetails.email) + '">' + escapeHtml(commitDetails.email) + '</a>&gt;<br>';
		html += '<b>Date: </b>' + (new Date(commitDetails.date * 1000)).toString() + '<br>';
		html += '<b>Committer: </b>' + escapeHtml(commitDetails.committer) + '</span>';
		if (typeof this.avatars[commitDetails.email] === 'string') html += '<span class="commitDetailsSummaryAvatar"><img src="' + this.avatars[commitDetails.email] + '"></span>';
		html += '</span></span><br><br>';
		html += escapeHtml(commitDetails.body).replace(/\n/g, '<br>') + '</div>';
		html += '<div id="commitDetailsFiles"><div id="commitDetailsFileViewSwitch">'
			+ '<span class="fileViewTypeBtn' + (this.fileViewType === 'tree' ? ' active' : '') + '" data-type="tree" title="File Tree">' + svgIcons.fileTree + '</span>'
			+ '<span class="fileViewTypeBtn' + (this.fileViewType === 'list' ? ' active' : '') + '" data-type="list" title="File List">' + svgIcons.fileList + '</span>'
			+ '</div>' + (this.fileViewType === 'tree' ? generateGitFileTreeHtml(fileTree, commitDetails.fileChanges, this.config.commitDetailsView.compactFolders) : generateGitFileListHtml(commitDetails.fileChanges)) + '</div>';
		html += '<div id="commitDetailsClose">' + svgIcons.close + '</div>';
		html += '</td>';

		newElem.id = 'commitDetails';
		newElem.innerHTML = html;
		insertAfter(newElem, this.expandedCommit.srcElem);

		this.renderGraph();

		if (this.config.autoCenterCommitDetailsView) {
			// Center Commit Detail View setting is enabled
			// control menu height [40px] + newElem.y + (commit details view height [250px] + commit height [24px]) / 2 - (window height) / 2
			window.scrollTo(0, newElem.offsetTop + 177 - window.innerHeight / 2);
		} else if (newElem.offsetTop + 8 < window.pageYOffset) {
			// Commit Detail View is opening above what is visible on screen
			// control menu height [40px] + newElem y - commit height [24px] - desired gap from top [8px] < pageYOffset
			window.scrollTo(0, newElem.offsetTop + 8);
		} else if (newElem.offsetTop + this.config.grid.expandY - window.innerHeight + 48 > window.pageYOffset) {
			// Commit Detail View is opening below what is visible on screen
			// control menu height [40px] + newElem y + commit details view height [250px] + desired gap from bottom [8px] - window height > pageYOffset
			window.scrollTo(0, newElem.offsetTop + this.config.grid.expandY - window.innerHeight + 48);
		}

		document.getElementById('commitDetailsClose')!.addEventListener('click', () => {
			this.hideCommitDetails();
		});
		addListenerToClass('gitFolder', 'click', (e) => {
			const sourceElem = <HTMLElement>(<Element>e.target!).closest('.gitFolder');
			const parent = sourceElem.parentElement!;
			parent.classList.toggle('closed');
			const isOpen = !parent.classList.contains('closed');
			parent.children[0].children[0].innerHTML = isOpen ? svgIcons.openFolder : svgIcons.closedFolder;
			parent.children[1].classList.toggle('hidden');
			alterGitFileTree(this.expandedCommit!.fileTree!, decodeURIComponent(sourceElem.dataset.folderpath!), isOpen);
			this.saveState();
		});
		addListenerToClass('gitFile', 'click', (e) => {
			const sourceElem = <HTMLElement>(<Element>e.target).closest('.gitFile')!;
			if (this.expandedCommit === null || !sourceElem.classList.contains('gitDiffPossible')) return;
			sendMessage({ command: 'viewDiff', repo: this.currentRepo!, commitHash: this.expandedCommit.hash, oldFilePath: decodeURIComponent(sourceElem.dataset.oldfilepath!), newFilePath: decodeURIComponent(sourceElem.dataset.newfilepath!), type: <GG.GitFileChangeType>sourceElem.dataset.type });
		});
		addListenerToClass('gitFile', 'contextmenu', (e) => {
			e.stopPropagation();
			const sourceElem = <HTMLElement>(<Element>e.target).closest('.gitFile')!;
			if (this.expandedCommit === null) return;
			const hash = this.expandedCommit.hash, type = <GG.GitFileChangeType>sourceElem.dataset.type;
			const oldFilePath = decodeURIComponent(sourceElem.dataset.oldfilepath!), newFilePath = decodeURIComponent(sourceElem.dataset.newfilepath!);
			const existsAtCommit = type !== 'D';
			showContextMenu(<MouseEvent>e, [
				{
					title: 'View Diff',
					visible: sourceElem.classList.contains('gitDiffPossible'),
					onClick: () => sendMessage({ command: 'viewDiff', repo: this.currentRepo!, commitHash: hash, oldFilePath: oldFilePath, newFilePath: newFilePath, type: type })
				},
				{
					title: 'View File at this Revision',
					visible: existsAtCommit,
					onClick: () => sendMessage({ command: 'viewFileAtRevision', repo: this.currentRepo!, commitHash: hash, filePath: newFilePath })
				},
				{
					title: 'View Diff with Working File',
					visible: existsAtCommit,
					onClick: () => sendMessage({ command: 'viewDiffWithWorkingFile', repo: this.currentRepo!, commitHash: hash, filePath: newFilePath })
				},
				{
					title: 'Open File',
					visible: existsAtCommit,
					onClick: () => sendMessage({ command: 'openFile', repo: this.currentRepo!, filePath: newFilePath })
				},
				null,
				{
					title: 'Copy Absolute File Path to Clipboard',
					onClick: () => sendMessage({ command: 'copyToClipboard', type: 'File Path', data: this.currentRepo + '/' + newFilePath })
				},
				{
					title: 'Copy Relative File Path to Clipboard',
					onClick: () => sendMessage({ command: 'copyToClipboard', type: 'File Path', data: newFilePath })
				}
			], sourceElem);
		});
		addListenerToClass('fileViewTypeBtn', 'click', (e) => {
			const type = <GG.FileViewType>(<HTMLElement>(<Element>e.target).closest('.fileViewTypeBtn')!).dataset.type;
			if (type === this.fileViewType || this.expandedCommit === null || this.expandedCommit.commitDetails === null || this.expandedCommit.fileTree === null) return;
			this.fileViewType = type;
			this.saveState();
			this.showCommitDetails(this.expandedCommit.commitDetails, this.expandedCommit.fileTree);
		});
	}
}

let contextMenu = document.getElementById('contextMenu')!, contextMenuSource: HTMLElement | null = null;
let dialog = document.getElementById('dialog')!, dialogBacking = document.getElementById('dialogBacking')!, dialogMenuSource: HTMLElement | null = null;
const gitGraph = new GitGraphView(viewState.repos, viewState.lastActiveRepo, {
	autoCenterCommitDetailsView: viewState.autoCenterCommitDetailsView,
	commitDetailsView: viewState.commitDetailsView,
	contextMenuActionsVisibility: viewState.contextMenuActionsVisibility,
	defaultColumnVisibility: viewState.defaultColumnVisibility,
	dialogDefaults: viewState.dialogDefaults,
	fetchAndPrune: viewState.fetchAndPrune,
	fetchAndPruneTags: viewState.fetchAndPruneTags,
	fetchAvatars: viewState.fetchAvatars,
	graphColours: viewState.graphColours,
	graphStyle: viewState.graphStyle,
	grid: { x: 16, y: 24, offsetX: 8, offsetY: 12, expandY: 250 },
	initialLoadCommits: viewState.initialLoadCommits,
	keyboardShortcuts: viewState.keyboardShortcuts,
	loadMoreCommits: viewState.loadMoreCommits,
	loadMoreCommitsAutomatically: viewState.loadMoreCommitsAutomatically,
	muteCommitsThatAreNotAncestorsOfHead: viewState.muteCommitsThatAreNotAncestorsOfHead,
	muteMergeCommits: viewState.muteMergeCommits,
	scrollToHeadOnLoad: viewState.scrollToHeadOnLoad,
	showCurrentBranchByDefault: viewState.showCurrentBranchByDefault,
	showRemoteBranches: viewState.showRemoteBranches
}, vscode.getState());


/* Command Processing */
window.addEventListener('message', event => {
	const msg: GG.ResponseMessage = event.data;
	switch (msg.command) {
		case 'addTag':
			refreshGraphOrDisplayError(msg.status, 'Unable to Add Tag');
			break;
		case 'applyStash':
			refreshGraphOrDisplayError(msg.status, 'Unable to Apply Stash');
			break;
		case 'branchFromStash':
			refreshGraphOrDisplayError(msg.status, 'Unable to Create Branch from Stash');
			break;
		case 'dropStash':
			refreshGraphOrDisplayError(msg.status, 'Unable to Drop Stash');
			break;
		case 'popStash':
			refreshGraphOrDisplayError(msg.status, 'Unable to Pop Stash');
			break;
		case 'pushStash':
			refreshGraphOrDisplayError(msg.status, 'Unable to Stash Uncommitted Changes');
			break;
		case 'checkoutBranch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Checkout Branch');
			break;
		case 'checkoutCommit':
			refreshGraphOrDisplayError(msg.status, 'Unable to Checkout Commit');
			break;
		case 'cherrypickCommit':
			refreshGraphOrDisplayError(msg.status, 'Unable to Cherry Pick Commit');
			break;
		case 'cleanUntrackedFiles':
			refreshGraphOrDisplayError(msg.status, 'Unable to Clean Untracked Files');
			break;
		case 'commitDetails':
			if (msg.commitDetails === null) {
				gitGraph.hideCommitDetails();
				showErrorDialog('Unable to load commit details', null, null);
			} else {
				gitGraph.showCommitDetails(msg.commitDetails, generateGitFileTree(msg.commitDetails.fileChanges));
			}
			break;
		case 'copyToClipboard':
			if (msg.success === false) showErrorDialog('Unable to Copy ' + msg.type + ' to Clipboard', null, null);
			break;
		case 'createBranch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Create Branch');
			break;
		case 'deleteBranch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Delete Branch');
			break;
		case 'deleteRemoteBranch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Delete Remote Branch');
			break;
		case 'deleteTag':
			refreshGraphOrDisplayError(msg.status, 'Unable to Delete Tag');
			break;
		case 'dropCommit':
			refreshGraphOrDisplayError(msg.status, 'Unable to Drop Commit');
			break;
		case 'fetch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Fetch from Remote(s)');
			break;
		case 'fetchIntoLocalBranch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Fetch into Local Branch');
			break;
		case 'fetchAvatar':
			gitGraph.loadAvatar(msg.email, msg.image);
			break;
		case 'loadBranches':
			gitGraph.loadBranches(msg.branches, msg.head, msg.remotes, msg.hard, msg.isRepo);
			break;
		case 'loadCommits':
			gitGraph.loadCommits(msg.commits, msg.head, msg.moreCommitsAvailable, msg.hard);
			break;
		case 'loadRepos':
			gitGraph.loadRepos(msg.repos, msg.lastActiveRepo);
			break;
		case 'mergeBranch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Merge Branch');
			break;
		case 'mergeCommit':
			refreshGraphOrDisplayError(msg.status, 'Unable to Merge Commit');
			break;
		case 'pullBranch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Pull Branch');
			break;
		case 'pushBranch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Push Branch');
			break;
		case 'pushTag':
			refreshGraphOrDisplayError(msg.status, 'Unable to Push Tag');
			break;
		case 'rebase':
			refreshGraphOrDisplayError(msg.status, 'Unable to Rebase');
			break;
		case 'renameBranch':
			refreshGraphOrDisplayError(msg.status, 'Unable to Rename Branch');
			break;
		case 'refresh':
			gitGraph.refresh(false);
			break;
		case 'selectRepo':
			gitGraph.selectRepo(msg.repo);
			break;
		case 'resetToCommit':
			refreshGraphOrDisplayError(msg.status, 'Unable to Reset to Commit');
			break;
		case 'resetUncommittedChanges':
			refreshGraphOrDisplayError(msg.status, 'Unable to Reset Uncommitted Changes');
			break;
		case 'revertCommit':
			refreshGraphOrDisplayError(msg.status, 'Unable to Revert Commit');
			break;
		case 'openFile':
			if (msg.success === false) showErrorDialog('Unable to open file', null, null);
			break;
		case 'viewDiff':
			if (msg.success === false) showErrorDialog('Unable to view diff of file', null, null);
			break;
		case 'viewDiffWithWorkingFile':
			if (msg.success === false) showErrorDialog('Unable to view diff with the working file', null, null);
			break;
		case 'viewFileAtRevision':
			if (msg.success === false) showErrorDialog('Unable to view the file at this revision', null, null);
			break;
	}
});
function refreshGraphOrDisplayError(status: GG.GitCommandStatus, errorMessage: string) {
	if (status === null) {
		hideDialog(); // Close the "action running" dialog, if one is open
		gitGraph.refresh(true);
	} else {
		showErrorDialog(errorMessage, status, null);
	}
}


/* Dates */
function getCommitDate(dateVal: number) {
	let date = new Date(dateVal * 1000), value;
	const dateStr = date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
	const timeStr = pad2(date.getHours()) + ':' + pad2(date.getMinutes());

	switch (viewState.dateFormat) {
		case 'Date Only':
			value = dateStr;
			break;
		case 'Relative':
			let diff = Math.round((new Date()).getTime() / 1000) - dateVal, unit;
			if (diff < 60) {
				unit = 'second';
			} else if (diff < 3600) {
				unit = 'minute';
				diff /= 60;
			} else if (diff < 86400) {
				unit = 'hour';
				diff /= 3600;
			} else if (diff < 604800) {
				unit = 'day';
				diff /= 86400;
			} else if (diff < 2629800) {
				unit = 'week';
				diff /= 604800;
			} else if (diff < 31557600) {
				unit = 'month';
				diff /= 2629800;
			} else {
				unit = 'year';
				diff /= 31557600;
			}
			diff = Math.round(diff);
			value = diff + ' ' + unit + (diff !== 1 ? 's' : '') + ' ago';
			break;
		default:
			value = dateStr + ' ' + timeStr;
	}
	return { title: dateStr + ' ' + timeStr, value: value };
}


/* Utils */
function generateGitFileTree(gitFiles: GG.GitFileChange[]) {
	// Folder contents use null-prototype objects so that path segments such as "constructor" or
	// "__proto__" are not confused with inherited Object.prototype members.
	let contents: GitFolderContents = Object.create(null), i, j, path, cur: GitFolder;
	const files: GitFolder = { type: 'folder', name: '', folderPath: '', contents: contents, open: true };
	for (i = 0; i < gitFiles.length; i++) {
		cur = files;
		path = gitFiles[i].newFilePath.split('/');
		for (j = 0; j < path.length; j++) {
			if (j < path.length - 1) {
				if (typeof cur.contents[path[j]] === 'undefined') {
					contents = Object.create(null);
					cur.contents[path[j]] = { type: 'folder', name: path[j], folderPath: path.slice(0, j + 1).join('/'), contents: contents, open: true };
				}
				cur = <GitFolder>cur.contents[path[j]];
			} else {
				cur.contents[path[j]] = { type: 'file', name: path[j], index: i };
			}
		}
	}
	return files;
}
function generateGitFileTreeHtml(folder: GitFolder, gitFiles: GG.GitFileChange[], compactFolders: boolean) {
	// With compact folders, a chain of folders that each only contain one folder is shown on one line
	let displayName = folder.name, deepest = folder;
	if (compactFolders) {
		let keys = Object.keys(deepest.contents);
		while (deepest.name !== '' && keys.length === 1 && deepest.contents[keys[0]].type === 'folder') {
			deepest = <GitFolder>deepest.contents[keys[0]];
			displayName += '/' + deepest.name;
			keys = Object.keys(deepest.contents);
		}
	}
	let html = (folder.name !== '' ? '<span class="gitFolder" data-folderpath="' + encodeURIComponent(deepest.folderPath) + '"><span class="gitFolderIcon">' + (deepest.open ? svgIcons.openFolder : svgIcons.closedFolder) + '</span><span class="gitFolderName">' + escapeHtml(displayName) + '</span></span>' : '') + '<ul class="gitFolderContents' + (!deepest.open ? ' hidden' : '') + '">', keys = Object.keys(deepest.contents), i, gitFile, gitFolder;
	keys.sort((a, b) => deepest.contents[a].type === 'folder' && deepest.contents[b].type === 'file' ? -1 : deepest.contents[a].type === 'file' && deepest.contents[b].type === 'folder' ? 1 : deepest.contents[a].name < deepest.contents[b].name ? -1 : deepest.contents[a].name > deepest.contents[b].name ? 1 : 0);
	for (i = 0; i < keys.length; i++) {
		if (deepest.contents[keys[i]].type === 'folder') {
			gitFolder = <GitFolder>deepest.contents[keys[i]];
			html += '<li' + (!gitFolder.open ? ' class="closed"' : '') + '>' + generateGitFileTreeHtml(gitFolder, gitFiles, compactFolders) + '</li>';
		} else {
			gitFile = gitFiles[(<GitFile>(deepest.contents[keys[i]])).index];
			html += generateGitFileHtml(gitFile, escapeHtml(deepest.contents[keys[i]].name));
		}
	}
	return html + '</ul>';
}
function generateGitFileListHtml(gitFiles: GG.GitFileChange[]) {
	const indexes = gitFiles.map((_, i) => i).sort((a, b) => gitFiles[a].newFilePath < gitFiles[b].newFilePath ? -1 : gitFiles[a].newFilePath > gitFiles[b].newFilePath ? 1 : 0);
	let html = '<ul class="gitFolderContents gitFileList">';
	for (let i = 0; i < indexes.length; i++) {
		const gitFile = gitFiles[indexes[i]], slash = gitFile.newFilePath.lastIndexOf('/');
		const label = slash > -1 ? '<span class="gitFileDirectory">' + escapeHtml(gitFile.newFilePath.substring(0, slash + 1)) + '</span>' + escapeHtml(gitFile.newFilePath.substring(slash + 1)) : escapeHtml(gitFile.newFilePath);
		html += generateGitFileHtml(gitFile, label);
	}
	return html + '</ul>';
}
function generateGitFileHtml(gitFile: GG.GitFileChange, labelHtml: string) {
	const diffPossible = gitFile.additions !== null && gitFile.deletions !== null;
	return '<li class="gitFile ' + gitFile.type + (diffPossible ? ' gitDiffPossible' : '') + '" data-oldfilepath="' + encodeURIComponent(gitFile.oldFilePath) + '" data-newfilepath="' + encodeURIComponent(gitFile.newFilePath) + '" data-type="' + gitFile.type + '"' + (!diffPossible ? ' title="This is a binary file, unable to view diff."' : '') + '><span class="gitFileIcon">' + svgIcons.file + '</span>' + labelHtml
		+ (gitFile.type === 'R' ? ' <span class="gitFileRename" title="' + escapeHtml(gitFile.oldFilePath + ' was renamed to ' + gitFile.newFilePath) + '">R</span>' : '')
		+ (gitFile.type !== 'A' && gitFile.type !== 'D' && diffPossible ? '<span class="gitFileAddDel">(<span class="gitFileAdditions" title="' + gitFile.additions + ' addition' + (gitFile.additions !== 1 ? 's' : '') + '">+' + gitFile.additions + '</span>|<span class="gitFileDeletions" title="' + gitFile.deletions + ' deletion' + (gitFile.deletions !== 1 ? 's' : '') + '">-' + gitFile.deletions + '</span>)</span>' : '')
		+ '</li>';
}
function alterGitFileTree(folder: GitFolder, folderPath: string, open: boolean) {
	let path = folderPath.split('/'), i, cur = folder;
	for (i = 0; i < path.length; i++) {
		if (typeof cur.contents[path[i]] !== 'undefined') {
			cur = <GitFolder>cur.contents[path[i]];
			if (i === path.length - 1) {
				cur.open = open;
				return;
			}
		} else {
			return;
		}
	}
}
function abbrevCommit(commitHash: string) {
	return commitHash.substring(0, 8);
}


/* Context Menu */
function showContextMenu(e: MouseEvent, allItems: ContextMenuElement[], sourceElem: HTMLElement) {
	const items = removeHiddenContextMenuItems(allItems);
	if (items.length === 0) return;
	let html = '', i: number, event = <MouseEvent>e;
	for (i = 0; i < items.length; i++) {
		html += items[i] !== null ? '<li class="contextMenuItem" data-index="' + i + '">' + items[i]!.title + '</li>' : '<li class="contextMenuDivider"></li>';
	}

	hideContextMenuListener();
	contextMenu.style.opacity = '0';
	contextMenu.className = 'active';
	contextMenu.innerHTML = html;
	const bounds = contextMenu.getBoundingClientRect();
	contextMenu.style.left = ((event.pageX - window.pageXOffset) + bounds.width < window.innerWidth ? event.pageX - 2 : event.pageX - bounds.width + 2) + 'px';
	contextMenu.style.top = ((event.pageY - window.pageYOffset) + bounds.height < window.innerHeight ? event.pageY - 2 : event.pageY - bounds.height + 2) + 'px';
	contextMenu.style.opacity = '1';

	addListenerToClass('contextMenuItem', 'click', (e) => {
		e.stopPropagation();
		hideContextMenu();
		items[parseInt((<HTMLElement>(e.target)).dataset.index!)]!.onClick();
	});

	contextMenuSource = sourceElem;
	contextMenuSource.classList.add('contextMenuActive');
}
/**
 * Drop items whose `visible` flag is false, then drop dividers that would be at the start, at the
 * end, or next to another divider.
 */
function removeHiddenContextMenuItems(items: ContextMenuElement[]) {
	const result: ContextMenuElement[] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item === null) {
			if (result.length > 0 && result[result.length - 1] !== null) result.push(null);
		} else if (item.visible !== false) {
			result.push(item);
		}
	}
	if (result.length > 0 && result[result.length - 1] === null) result.pop();
	return result;
}
function hideContextMenu() {
	contextMenu.className = '';
	contextMenu.innerHTML = '';
	contextMenu.style.left = '0px';
	contextMenu.style.top = '0px';
	if (contextMenuSource !== null) {
		contextMenuSource.classList.remove('contextMenuActive');
		contextMenuSource = null;
	}
}


/* Dialogs */
function showConfirmationDialog(message: string, confirmed: () => void, sourceElem: HTMLElement | null) {
	showDialog(message, 'Yes', 'No', () => {
		hideDialog();
		confirmed();
	}, sourceElem);
}
function showRefInputDialog(message: string, defaultValue: string, actionName: string, actioned: (value: string) => void, sourceElem: HTMLElement | null) {
	showFormDialog(message, [{ type: 'text-ref', name: '', default: defaultValue }], actionName, values => actioned(values[0]), sourceElem);
}
function showCheckboxDialog(message: string, checkboxLabel: string, checkboxValue: boolean, actionName: string, actioned: (value: boolean) => void, sourceElem: HTMLElement | null) {
	showFormDialog(message, [{ type: 'checkbox', name: checkboxLabel, value: checkboxValue }], actionName, values => actioned(values[0] === 'checked'), sourceElem);
}
function showSelectDialog(message: string, defaultValue: string, options: { name: string, value: string }[], actionName: string, actioned: (value: string) => void, sourceElem: HTMLElement | null) {
	showFormDialog(message, [{ type: 'select', name: '', options: options, default: defaultValue }], actionName, values => actioned(values[0]), sourceElem);
}
function showFormDialog(message: string, inputs: DialogInput[], actionName: string, actioned: (values: string[]) => void, sourceElem: HTMLElement | null) {
	let textRefInput = -1, multiElementForm = inputs.length > 1;
	let html = message + '<br><table class="dialogForm ' + (multiElementForm ? 'multi' : 'single') + '">';
	for (let i = 0; i < inputs.length; i++) {
		const input = inputs[i];
		html += '<tr>' + (multiElementForm ? '<td>' + input.name + '</td>' : '') + '<td>';
		if (input.type === 'select') {
			html += '<select id="dialogInput' + i + '">';
			for (let j = 0; j < input.options.length; j++) {
				html += '<option value="' + escapeHtml(input.options[j].value) + '"' + (input.options[j].value === input.default ? ' selected' : '') + '>' + escapeHtml(input.options[j].name) + '</option>';
			}
			html += '</select>';
		} else if (input.type === 'checkbox') {
			html += '<span class="dialogFormCheckbox"><label><input id="dialogInput' + i + '" type="checkbox"' + (input.value ? ' checked' : '') + '/>' + (multiElementForm ? '' : input.name) + '</label></span>';
		} else {
			html += '<input id="dialogInput' + i + '" type="text" value="' + input.default + '"' + (input.type === 'text' && input.placeholder !== null ? ' placeholder="' + input.placeholder + '"' : '') + '/>';
			if (input.type === 'text-ref') textRefInput = i;
		}
		html += '</td></tr>';
	}
	html += '</table>';
	showDialog(html, actionName, 'Cancel', () => {
		if (dialog.className === 'active noInput' || dialog.className === 'active inputInvalid') return;
		const values = [];
		for (let i = 0; i < inputs.length; i++) {
			const input = inputs[i], elem = document.getElementById('dialogInput' + i);
			if (input.type === 'select') {
				values.push((<HTMLSelectElement>elem).value);
			} else if (input.type === 'checkbox') {
				values.push((<HTMLInputElement>elem).checked ? 'checked' : 'unchecked');
			} else {
				values.push((<HTMLInputElement>elem).value);
			}
		}
		hideDialog();
		actioned(values);
	}, sourceElem);

	if (textRefInput > -1) {
		const dialogInput = <HTMLInputElement>document.getElementById('dialogInput' + textRefInput), dialogAction = document.getElementById('dialogAction')!;
		if (dialogInput.value === '') dialog.className = 'active noInput';
		dialogInput.focus();
		dialogInput.addEventListener('keyup', () => {
			const substitution = gitGraph.getDialogDefaults().general.referenceInputSpaceSubstitution;
			if (substitution !== null && dialogInput.value.indexOf(' ') > -1) {
				const caret = dialogInput.selectionStart;
				dialogInput.value = dialogInput.value.split(' ').join(substitution);
				if (caret !== null) dialogInput.setSelectionRange(caret, caret);
			}
			const noInput = dialogInput.value === '', invalidInput = dialogInput.value.match(refInvalid) !== null;
			const newClassName = 'active' + (noInput ? ' noInput' : invalidInput ? ' inputInvalid' : '');
			if (dialog.className !== newClassName) {
				dialog.className = newClassName;
				dialogAction.title = invalidInput ? 'Unable to ' + actionName + ', one or more invalid characters entered.' : '';
			}
		});
	}
}
function showErrorDialog(message: string, reason: string | null, sourceElem: HTMLElement | null) {
	showDialog(svgIcons.alert + 'Error: ' + message + (reason !== null ? '<br><span class="errorReason">' + escapeHtml(reason).split('\n').join('<br>') + '</span>' : ''), null, 'Dismiss', null, sourceElem);
}
function showActionRunningDialog(command: string) {
	showDialog('<span id="actionRunning">' + svgIcons.loading + command + ' ...</span>', null, 'Dismiss', null, null);
}
function showDialog(html: string, actionName: string | null, dismissName: string, actioned: (() => void) | null, sourceElem: HTMLElement | null) {
	dialogBacking.className = 'active';
	dialog.className = 'active';
	dialog.innerHTML = html + '<br>' + (actionName !== null ? '<div id="dialogAction" class="roundedBtn">' + actionName + '</div>' : '') + '<div id="dialogDismiss" class="roundedBtn">' + dismissName + '</div>';
	if (actionName !== null && actioned !== null) document.getElementById('dialogAction')!.addEventListener('click', actioned);
	document.getElementById('dialogDismiss')!.addEventListener('click', hideDialog);

	dialogMenuSource = sourceElem;
	if (dialogMenuSource !== null) dialogMenuSource.classList.add('dialogActive');
}
function hideDialog() {
	dialogBacking.className = '';
	dialog.className = '';
	dialog.innerHTML = '';
	if (dialogMenuSource !== null) {
		dialogMenuSource.classList.remove('dialogActive');
		dialogMenuSource = null;
	}
}

function hideDialogAndContextMenu() {
	if (dialog.classList.contains('active')) hideDialog();
	if (contextMenu.classList.contains('active')) hideContextMenu();
}

/* Global Listeners */
document.addEventListener('keyup', (e) => {
	if (e.key === 'Escape') hideDialogAndContextMenu();
});
document.addEventListener('click', hideContextMenuListener);
document.addEventListener('contextmenu', hideContextMenuListener);
document.addEventListener('mouseleave', hideContextMenuListener);
function hideContextMenuListener() {
	if (contextMenu.classList.contains('active')) hideContextMenu();
}

/* Columns */
function getColumnVisibilityClasses(visibility: GG.ColumnVisibility) {
	const classes: string[] = [];
	if (!visibility.date) classes.push('hideDate');
	if (!visibility.author) classes.push('hideAuthor');
	if (!visibility.commit) classes.push('hideCommit');
	return classes.join(' ');
}
