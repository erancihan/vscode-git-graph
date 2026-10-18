interface FindWidgetView {
	getCommits(): GG.GitCommitNode[];
	getRowElem(id: number): HTMLElement | null;
	isCommitDetailsOpen(): boolean;
	openCommitDetails(rowElem: HTMLElement): void;
}

/**
 * The find widget: a text input at the top right of the view that highlights the commits whose
 * message, author, email, hash or reference names match, and steps through the matches. Opened with
 * the configured keyboard shortcut (Ctrl/Cmd + key), closed with Escape or the close button.
 */
class FindWidget {
	private readonly view: FindWidgetView;
	private readonly widgetElem: HTMLElement;
	private readonly inputElem: HTMLInputElement;
	private readonly countElem: HTMLElement;
	private readonly caseSensitiveElem: HTMLElement;
	private readonly regexElem: HTMLElement;
	private readonly prevElem: HTMLElement;
	private readonly nextElem: HTMLElement;

	private visible: boolean = false;
	private caseSensitive: boolean = false;
	private regex: boolean = false;
	private matches: number[] = []; // Row ids (indexes into the commits array) of the matching commits
	private position: number = -1; // Index in matches of the current match

	constructor(view: FindWidgetView) {
		this.view = view;
		this.widgetElem = document.createElement('div');
		this.widgetElem.id = 'findWidget';
		this.widgetElem.innerHTML = '<input id="findInput" type="text" placeholder="Find" spellcheck="false">'
			+ '<span id="findCaseSensitive" class="findBtn" title="Match Case">Aa</span>'
			+ '<span id="findRegex" class="findBtn" title="Use Regular Expression">.*</span>'
			+ '<span id="findCount"></span>'
			+ '<span id="findPrev" class="findBtn" title="Previous match (Shift+Enter)">&#9650;</span>'
			+ '<span id="findNext" class="findBtn" title="Next match (Enter)">&#9660;</span>'
			+ '<span id="findClose" class="findBtn" title="Close (Escape)">&#10005;</span>';
		document.body.appendChild(this.widgetElem);

		this.inputElem = <HTMLInputElement>document.getElementById('findInput')!;
		this.countElem = document.getElementById('findCount')!;
		this.caseSensitiveElem = document.getElementById('findCaseSensitive')!;
		this.regexElem = document.getElementById('findRegex')!;
		this.prevElem = document.getElementById('findPrev')!;
		this.nextElem = document.getElementById('findNext')!;

		this.inputElem.addEventListener('input', () => this.search(true));
		this.inputElem.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.step(e.shiftKey ? -1 : 1);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				this.close();
			}
		});
		this.caseSensitiveElem.addEventListener('click', () => {
			this.caseSensitive = !this.caseSensitive;
			this.caseSensitiveElem.className = 'findBtn' + (this.caseSensitive ? ' active' : '');
			this.search(true);
		});
		this.regexElem.addEventListener('click', () => {
			this.regex = !this.regex;
			this.regexElem.className = 'findBtn' + (this.regex ? ' active' : '');
			this.search(true);
		});
		this.prevElem.addEventListener('click', () => this.step(-1));
		this.nextElem.addEventListener('click', () => this.step(1));
		document.getElementById('findClose')!.addEventListener('click', () => this.close());
	}

	public show() {
		if (!this.visible) {
			this.visible = true;
			this.widgetElem.classList.add('active');
			this.search(true);
		}
		this.inputElem.focus();
		this.inputElem.select();
	}

	public close() {
		if (!this.visible) return;
		this.visible = false;
		this.widgetElem.classList.remove('active');
		this.clearHighlights();
		this.matches = [];
		this.position = -1;
	}

	public isVisible() {
		return this.visible;
	}

	/** Re-run the search after the table was rendered again. Keeps the current match when it still exists. */
	public update() {
		if (this.visible) this.search(false);
	}

	private getMatcher(): ((text: string) => boolean) | null {
		const text = this.inputElem.value;
		if (text === '') return null;
		if (this.regex) {
			try {
				const re = new RegExp(text, this.caseSensitive ? '' : 'i');
				this.inputElem.classList.remove('invalid');
				return (value) => re.test(value);
			} catch {
				this.inputElem.classList.add('invalid');
				return null;
			}
		}
		this.inputElem.classList.remove('invalid');
		if (this.caseSensitive) return (value) => value.indexOf(text) > -1;
		const lower = text.toLowerCase();
		return (value) => value.toLowerCase().indexOf(lower) > -1;
	}

	private search(moveToFirst: boolean) {
		const previousHash = this.position > -1 && this.position < this.matches.length ? this.getHashOfMatch(this.position) : null;
		this.clearHighlights();
		this.matches = [];
		const matcher = this.getMatcher();
		if (matcher !== null) {
			const commits = this.view.getCommits();
			for (let i = 0; i < commits.length; i++) {
				const commit = commits[i];
				if (commit.hash === '*') continue;
				if (matcher(commit.message) || matcher(commit.author) || matcher(commit.email) || matcher(commit.hash) || commit.refs.some((ref) => matcher(ref.name))) {
					this.matches.push(i);
				}
			}
		}

		if (this.matches.length === 0) {
			this.position = -1;
		} else if (!moveToFirst && previousHash !== null) {
			const commits = this.view.getCommits();
			const kept = this.matches.findIndex((id) => commits[id].hash === previousHash);
			this.position = kept > -1 ? kept : 0;
		} else {
			this.position = 0;
		}

		for (let i = 0; i < this.matches.length; i++) {
			const row = this.view.getRowElem(this.matches[i]);
			if (row !== null) row.classList.add('findMatch');
		}
		this.renderCurrent(moveToFirst);
	}

	private step(delta: number) {
		if (this.matches.length === 0) return;
		this.position = (this.position + delta + this.matches.length) % this.matches.length;
		this.renderCurrent(true);
		if (this.view.isCommitDetailsOpen()) {
			const row = this.view.getRowElem(this.matches[this.position]);
			if (row !== null) this.view.openCommitDetails(row);
		}
	}

	private renderCurrent(scroll: boolean) {
		const current = document.querySelector('#commitTable tr.findCurrent');
		if (current !== null) current.classList.remove('findCurrent');
		if (this.position > -1) {
			const row = this.view.getRowElem(this.matches[this.position]);
			if (row !== null) {
				row.classList.add('findCurrent');
				if (scroll) row.scrollIntoView({ block: 'center' });
			}
		}
		const hasText = this.inputElem.value !== '';
		this.countElem.textContent = !hasText ? '' : this.matches.length === 0 ? 'No results' : (this.position + 1) + ' of ' + this.matches.length;
		this.prevElem.className = 'findBtn' + (this.matches.length === 0 ? ' disabled' : '');
		this.nextElem.className = 'findBtn' + (this.matches.length === 0 ? ' disabled' : '');
	}

	private getHashOfMatch(position: number) {
		const commits = this.view.getCommits();
		const id = this.matches[position];
		return id < commits.length ? commits[id].hash : null;
	}

	private clearHighlights() {
		const rows = document.querySelectorAll('#commitTable tr.findMatch, #commitTable tr.findCurrent');
		for (let i = 0; i < rows.length; i++) {
			rows[i].classList.remove('findMatch');
			rows[i].classList.remove('findCurrent');
		}
	}
}
