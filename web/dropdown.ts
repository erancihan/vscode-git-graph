class Dropdown {
	private options: DropdownOption[] = [];
	private selectedOptions: number[] = [0];
	private dropdownVisible: boolean = false;
	private showInfo: boolean;
	private multipleAllowed: boolean;
	private changeCallback: { (values: string[]): void };

	private elem: HTMLElement;
	private currentValueElem: HTMLDivElement;
	private menuElem: HTMLDivElement;
	private optionsElem: HTMLDivElement;
	private noResultsElem: HTMLDivElement;
	private filterInput: HTMLInputElement;

	/**
	 * @param multipleAllowed When true, Ctrl/Cmd+click on an option adds it to (or removes it from) the
	 * selection and keeps the dropdown open. Option 0 is exclusive: selecting it clears the others.
	 */
	constructor(id: string, showInfo: boolean, multipleAllowed: boolean, dropdownType: string, changeCallback: { (values: string[]): void }) {
		this.showInfo = showInfo;
		this.multipleAllowed = multipleAllowed;
		this.changeCallback = changeCallback;
		this.elem = document.getElementById(id)!;

		const filter = document.createElement('div');
		filter.className = 'dropdownFilter';
		this.filterInput = document.createElement('input');
		this.filterInput.className = 'dropdownFilterInput';
		this.filterInput.placeholder = 'Filter ' + dropdownType + '...';
		filter.appendChild(this.filterInput);
		this.menuElem = document.createElement('div');
		this.menuElem.className = 'dropdownMenu';
		this.menuElem.appendChild(filter);
		this.optionsElem = document.createElement('div');
		this.optionsElem.className = 'dropdownOptions';
		this.menuElem.appendChild(this.optionsElem);
		this.noResultsElem = document.createElement('div');
		this.noResultsElem.className = 'dropdownNoResults';
		this.noResultsElem.innerHTML = 'No results found.';
		this.menuElem.appendChild(this.noResultsElem);
		this.currentValueElem = document.createElement('div');
		this.currentValueElem.className = 'dropdownCurrentValue';
		this.elem.appendChild(this.currentValueElem);
		this.elem.appendChild(this.menuElem);

		document.addEventListener('click', (e) => {
			if (!e.target) return;
			if (e.target === this.currentValueElem) {
				this.dropdownVisible = !this.dropdownVisible;
				if (this.dropdownVisible) {
					this.filterInput.value = '';
					this.filter();
				}
				this.elem.classList.toggle('dropdownOpen');
				if (this.dropdownVisible) this.filterInput.focus();
			} else if (this.dropdownVisible) {
				if ((<HTMLElement>e.target).closest('.dropdown') !== this.elem) {
					this.close();
				} else {
					const option = <HTMLElement | null>(<HTMLElement>e.target).closest('.dropdownOption');
					if (option !== null && option.parentNode === this.optionsElem && typeof option.dataset.id !== 'undefined') {
						const selectedOption = parseInt(option.dataset.id!);
						if (this.multipleAllowed && (e.ctrlKey || e.metaKey) && selectedOption !== 0) {
							// Toggle the option in the selection, keep the dropdown open
							const index = this.selectedOptions.indexOf(selectedOption);
							if (index > -1) {
								this.selectedOptions.splice(index, 1);
								if (this.selectedOptions.length === 0) this.selectedOptions = [0];
							} else {
								this.selectedOptions = this.selectedOptions.filter((i) => i !== 0).concat([selectedOption]).sort((a, b) => a - b);
							}
							this.render();
							this.changeCallback(this.getSelectedValues());
						} else {
							this.close();
							if (this.selectedOptions.length !== 1 || this.selectedOptions[0] !== selectedOption) {
								this.selectedOptions = [selectedOption];
								this.render();
								this.changeCallback(this.getSelectedValues());
							}
						}
					}
				}
			}
		}, true);
		document.addEventListener('contextmenu', () => this.close(), true);
		document.addEventListener('keyup', (e) => {
			if (e.key === 'Escape') this.close();
		}, true);
		this.filterInput.addEventListener('keyup', () => this.filter());
	}

	public getOptions() {
		return this.options;
	}

	public setOptions(options: DropdownOption[], selected: string[]) {
		this.options = options;
		const selectedOptions: number[] = [];
		for (let i = 0; i < options.length; i++) {
			if (selected.indexOf(options[i].value) > -1) selectedOptions.push(i);
		}
		this.selectedOptions = selectedOptions.length > 0 ? selectedOptions : [0];
		if (options.length <= 1) this.close();
		this.render();
	}

	public getSelectedValues() {
		return this.selectedOptions.map((i) => this.options[i].value);
	}

	public refresh() {
		if (this.options.length > 0) this.render();
	}

	private render() {
		this.elem.classList.add('loaded');
		this.currentValueElem.innerHTML = escapeHtml(this.selectedOptions.map((i) => this.options[i].name).join(', '));
		this.currentValueElem.title = this.multipleAllowed ? 'Ctrl/Cmd+click an option to select more than one' : '';
		let html = '';
		for (let i = 0; i < this.options.length; i++) {
			html += '<div class="dropdownOption' + (this.selectedOptions.indexOf(i) > -1 ? ' selected' : '') + '" data-id="' + i + '">' + escapeHtml(this.options[i].name) + (this.showInfo ? '<div class="dropdownOptionInfo" title="' + escapeHtml(this.options[i].value) + '">' + svgIcons.info + '</div>' : '') + '</div>';
		}
		this.optionsElem.className = 'dropdownOptions' + (this.showInfo ? ' showInfo' : '');
		this.optionsElem.innerHTML = html;
		this.filterInput.style.display = 'none';
		this.noResultsElem.style.display = 'none';
		this.menuElem.style.cssText = 'opacity:0; display:block;';
		// Width must be at least 130px for the filter elements. Max height for the dropdown is [filter (31px) + 9.5 * dropdown item (28px) = 297px]
		// Don't need to add 12px if showing info icons and scrollbar isn't needed. The scrollbar isn't needed if: menuElem height + filter input (25px) < 297px
		this.currentValueElem.style.width = Math.max(this.menuElem.offsetWidth + (this.showInfo && this.menuElem.offsetHeight < 272 ? 0 : 12), 130) + 'px';
		this.menuElem.style.cssText = 'right:0; overflow-y:auto; max-height:297px;';
		if (this.dropdownVisible) this.filter();
	}

	private filter() {
		let val = this.filterInput.value.toLowerCase(), match, matches = false;
		for (let i = 0; i < this.options.length; i++) {
			match = this.options[i].name.toLowerCase().indexOf(val) > -1;
			(<HTMLElement>this.optionsElem.children[i]).style.display = match ? 'block' : 'none';
			if (match) matches = true;
		}
		this.filterInput.style.display = 'block';
		this.noResultsElem.style.display = matches ? 'none' : 'block';
	}

	private close() {
		this.elem.classList.remove('dropdownOpen');
		this.dropdownVisible = false;
	}
}

interface DropdownOption {
	name: string;
	value: string;
}