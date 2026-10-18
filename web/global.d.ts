import * as GG from "../out/types";

declare global {
	function acquireVsCodeApi(): {
		getState(): WebViewState | null,
		postMessage(message: GG.RequestMessage): void,
		setState(state: WebViewState): void
	};

	var viewState: GG.GitGraphViewState;

	interface Config {
		autoCenterCommitDetailsView: boolean;
		commitDetailsView: GG.CommitDetailsViewConfig;
		customBranchGlobPatterns: GG.CustomBranchGlobPattern[];
		customPullRequestProviders: GG.CustomPullRequestProvider[];
		contextMenuActionsVisibility: GG.ContextMenuActionsVisibility;
		defaultColumnVisibility: GG.ColumnVisibility;
		dialogDefaults: GG.DialogDefaults;
		fetchAndPrune: boolean;
		fetchAndPruneTags: boolean;
		fetchAvatars: boolean;
		ciStatus: GG.CiStatusConfig;
		graphColours: string[];
		graphStyle: 'rounded' | 'angular';
		grid: { x: number, y: number, offsetX: number, offsetY: number, expandY: number };
		initialLoadCommits: number;
		keyboardShortcuts: GG.KeyboardShortcuts;
		loadMoreCommits: number;
		loadMoreCommitsAutomatically: boolean;
		muteCommitsThatAreNotAncestorsOfHead: boolean;
		muteMergeCommits: boolean;
		referenceLabels: GG.ReferenceLabelsConfig;
		scrollToHeadOnLoad: boolean;
		showCurrentBranchByDefault: boolean;
		showRemoteBranches: boolean;
		stickyHeader: boolean;
	}

	interface ContextMenuItem {
		title: string;
		onClick: () => void;
		/** Set to false to leave the item out of the menu (from the contextMenuActionsVisibility setting). */
		visible?: boolean;
	}

	type ContextMenuElement = ContextMenuItem | null;

	interface DialogTextInput {
		type: 'text';
		name: string;
		default: string;
		placeholder: string | null;
	}
	interface DialogTextRefInput {
		type: 'text-ref';
		name: string;
		default: string;
	}
	interface DialogSelectInput {
		type: 'select';
		name: string;
		options: { name: string, value: string }[];
		default: string;
	}
	interface DialogCheckboxInput {
		type: 'checkbox';
		name: string;
		value: boolean;
	}
	interface DialogTextareaInput {
		type: 'textarea';
		name: string;
		default: string;
		placeholder: string | null;
	}
	type DialogInput = DialogTextInput | DialogTextRefInput | DialogSelectInput | DialogCheckboxInput | DialogTextareaInput;
	type DialogInputValue = string | boolean;

	interface ExpandedCommit {
		id: number;
		hash: string;
		srcElem: HTMLElement | null;
		commitDetails: GG.GitCommitDetails | null;
		fileTree: GitFolder | null;
		/** Set when the view compares the commit with another commit ("*" is the working tree). */
		compareWithHash: string | null;
		compareWithSrcElem: HTMLElement | null;
		compareFileChanges: GG.GitFileChange[] | null;
	}

	interface GitFile {
		type: 'file';
		name: string;
		index: number;
	}

	interface GitFolder {
		type: 'folder';
		name: string;
		folderPath: string;
		contents: GitFolderContents;
		open: boolean;
	}

	type GitFolderOrFile = GitFolder | GitFile;
	type GitFolderContents = { [name: string]: GitFolderOrFile };

	interface Point {
		x: number;
		y: number;
	}
	interface Line {
		p1: Point;
		p2: Point;
		lockedFirst: boolean; // TRUE => The line is locked to p1, FALSE => The line is locked to p2
	}

	interface Pixel {
		x: number;
		y: number;
	}
	interface PlacedLine {
		p1: Pixel;
		p2: Pixel;
		isCommitted: boolean;
		lockedFirst: boolean; // TRUE => The line is locked to p1, FALSE => The line is locked to p2
	}

	interface UnavailablePoint {
		connectsTo: VertexOrNull;
		onBranch: Branch;
	}
	type VertexOrNull = Vertex | null;

	type AvatarImageCollection = { [email: string]: string };

	interface WebViewState {
		gitRepos: GG.GitRepoSet;
		gitBranches: string[];
		gitBranchHead: string | null;
		gitRemotes: string[];
		commits: GG.GitCommitNode[];
		commitHead: string | null;
		avatars: AvatarImageCollection;
		ciStatuses: { [hash: string]: GG.CommitCiStatus };
		currentBranches: string[] | null;
		filters?: GG.GraphFilters; // missing in state written before 2.4.0
		currentBranch?: string | null; // State written by versions before 2.2.0
		currentRepo: string;
		moreCommitsAvailable: boolean;
		maxCommits: number;
		showRemoteBranches: boolean;
		expandedCommit: ExpandedCommit | null;
		fileViewType: GG.FileViewType;
		/** Height of the commit details view in pixels. Missing in state written by versions before 2.2.1. */
		commitDetailsHeight?: number;
	}
}

export as namespace GG;
export = GG;
