/* Git Interfaces / Types */

export interface GitCommitNode {
	hash: string;
	parentHashes: string[];
	author: string;
	email: string;
	date: number;
	message: string;
	refs: GitRef[];
	stash: GitStash | null;
	/** Set when `git-graph.repository.commits.showSignatureStatus` is enabled and the commit is not the uncommitted changes row. */
	signature: GitSignature | null;
}

/** A stash entry. The stash commit is shown as a row above `baseHash`, the commit it was created from. */
export interface GitStash {
	selector: string; // e.g. "stash@{0}"
	baseHash: string;
	untrackedFilesHash: string | null;
}

export interface GitCommit {
	hash: string;
	parentHashes: string[];
	author: string;
	email: string;
	date: number;
	message: string;
	stash?: GitStash;
	signature?: GitSignature;
}

/**
 * Result of verifying the GPG signature of a commit, from the `%G?`, `%GS` and `%GK` placeholders:
 * G good, B bad, U good but the key is untrusted, X good but the signature expired, Y good but the
 * key expired, R good but the key was revoked, E the signature could not be checked, N unsigned.
 */
export type GitSignatureStatus = 'G' | 'B' | 'U' | 'X' | 'Y' | 'R' | 'E' | 'N';
export interface GitSignature {
	status: GitSignatureStatus;
	signer: string;
	key: string;
}

export interface GitCommitDetails {
	hash: string;
	parents: string[];
	author: string;
	email: string;
	date: number;
	committer: string;
	body: string;
	fileChanges: GitFileChange[];
	signature: GitSignature | null;
}

export interface GitRef {
	hash: string;
	name: string;
	type: 'head' | 'tag' | 'remote' | 'stash';
}

export interface GitRefData {
	head: string | null;
	refs: GitRef[];
}

export type GitRepoSet = { [repo: string]: GitRepoState };
export interface GitRepoState {
	columnWidths: number[] | null;
	columnVisibility: ColumnVisibility | null; // null => use the default from the settings
	/** Custom name shown in the repository dropdown. null => the folder name. */
	name: string | null;
	/** Remotes whose branches are hidden from the graph and the branch dropdown. */
	hideRemotes: string[];
	// Per-repository overrides of the settings. null => use the setting.
	showTags: boolean | null;
	showStashes: boolean | null;
	includeCommitsMentionedByReflogs: boolean | null;
	onlyFollowFirstParent: boolean | null;
}

export interface GitRemoteDetails {
	name: string;
	url: string | null;
	pushUrl: string | null; // null => the fetch url is used for pushing
}

/** `user.name` and `user.email` from the repository's local configuration and from the global configuration. */
export interface GitUserDetails {
	localName: string | null;
	localEmail: string | null;
	globalName: string | null;
	globalEmail: string | null;
}

export interface GitRepoSettings {
	remotes: GitRemoteDetails[];
	user: GitUserDetails;
}

export interface ColumnVisibility {
	date: boolean;
	author: boolean;
	commit: boolean;
}

export interface GitUnsavedChanges {
	branch: string;
	changes: number;
}

export interface ContextMenuActionsVisibility {
	branch: { checkout: boolean, rename: boolean, delete: boolean, merge: boolean, rebase: boolean, push: boolean, archive: boolean, copyName: boolean };
	commit: { addTag: boolean, createBranch: boolean, checkout: boolean, cherrypick: boolean, revert: boolean, drop: boolean, merge: boolean, rebase: boolean, reset: boolean, archive: boolean, copyHash: boolean };
	remoteBranch: { checkout: boolean, delete: boolean, fetch: boolean, pull: boolean, copyName: boolean };
	stash: { apply: boolean, createBranch: boolean, pop: boolean, drop: boolean, copyName: boolean, copyHash: boolean };
	tag: { delete: boolean, push: boolean, archive: boolean, copyName: boolean };
	uncommittedChanges: { reset: boolean, clean: boolean, stash: boolean };
}

export interface KeyboardShortcuts {
	// Single lower-case letters, pressed with Ctrl / Cmd
	find: string;
	refresh: string;
	scrollToHead: string;
	scrollToStash: string;
}

export interface DialogDefaults {
	addTag: { type: 'annotated' | 'lightweight' };
	applyStash: { reinstateIndex: boolean };
	cherryPick: { noCommit: boolean, recordOrigin: boolean };
	createBranch: { checkOut: boolean };
	deleteBranch: { forceDelete: boolean };
	fetchIntoLocalBranch: { forceFetch: boolean };
	merge: { noFastForward: boolean, noCommit: boolean, squashCommits: boolean };
	popStash: { reinstateIndex: boolean };
	pullBranch: { noFastForward: boolean, squashCommits: boolean };
	rebase: { ignoreDate: boolean, launchInteractiveRebase: boolean };
	resetCurrentBranchToCommit: { mode: GitResetMode };
	resetUncommittedChanges: { mode: 'mixed' | 'hard' };
	stashUncommittedChanges: { includeUntracked: boolean };
	general: { referenceInputSpaceSubstitution: string | null };
}

export type FileViewType = 'tree' | 'list';

export type CommitDetailsViewLocation = 'Inline' | 'Docked to Bottom';
export interface CommitDetailsViewConfig {
	fileViewType: FileViewType;
	compactFolders: boolean;
	location: CommitDetailsViewLocation;
}

export interface CustomBranchGlobPattern {
	name: string;
	glob: string;
}

export interface GitGraphViewState {
	autoCenterCommitDetailsView: boolean;
	commitDetailsView: CommitDetailsViewConfig;
	customBranchGlobPatterns: CustomBranchGlobPattern[];
	contextMenuActionsVisibility: ContextMenuActionsVisibility;
	dateFormat: DateFormat;
	defaultColumnVisibility: ColumnVisibility;
	dialogDefaults: DialogDefaults;
	fetchAndPrune: boolean;
	fetchAndPruneTags: boolean;
	fetchAvatars: boolean;
	graphColours: string[];
	graphStyle: GraphStyle;
	initialLoadCommits: number;
	keyboardShortcuts: KeyboardShortcuts;
	lastActiveRepo: string | null;
	loadMoreCommits: number;
	loadMoreCommitsAutomatically: boolean;
	muteCommitsThatAreNotAncestorsOfHead: boolean;
	muteMergeCommits: boolean;
	referenceLabels: ReferenceLabelsConfig;
	repos: GitRepoSet;
	scrollToHeadOnLoad: boolean;
	showCurrentBranchByDefault: boolean;
	showRemoteBranches: boolean;
}

export interface GitFileChange {
	oldFilePath: string;
	newFilePath: string;
	type: GitFileChangeType;
	additions: number | null;
	deletions: number | null;
}

export interface Avatar {
	image: string;
	timestamp: number;
	identicon: boolean;
}
export type AvatarCache = { [email: string]: Avatar };

export type DateFormat = 'Date & Time' | 'Date Only' | 'Relative';
export type DateType = 'Author Date' | 'Commit Date';
export type GraphStyle = 'rounded' | 'angular';
export type TabIconColourTheme = 'colour' | 'grey';
export type GitCommandStatus = string | null;
export type GitResetMode = 'soft' | 'mixed' | 'hard';
export type CommitOrdering = 'date' | 'author-date' | 'topo';
export type GitPushBranchMode = 'normal' | 'force' | 'force-with-lease';
export type GitRebaseType = 'Branch' | 'Commit';
export type RepoDropdownOrder = 'Full Path' | 'Name' | 'Workspace Full Path';
export type ReferenceLabelAlignment = 'Normal' | 'Branches (on the left) & Tags (on the right)' | 'Branches (aligned to the graph) & Tags (on the right)';
export interface ReferenceLabelsConfig {
	alignment: ReferenceLabelAlignment;
	combineLocalAndRemoteBranchLabels: boolean;
}
export type SquashMessageFormat = 'Default' | 'Git SQUASH_MSG';
export interface MergeOptions { createNewCommit: boolean; squash: boolean; noCommit: boolean; }
export interface CherryPickOptions { parentIndex: number; recordOrigin: boolean; noCommit: boolean; }
export type GitFileChangeType = 'A' | 'M' | 'D' | 'R';


/* Request / Response Messages */

export interface RequestAddTag {
	command: 'addTag';
	repo: string;
	commitHash: string;
	tagName: string;
	lightweight: boolean;
	message: string;
}
export interface ResponseAddTag {
	command: 'addTag';
	status: GitCommandStatus;
}

export interface RequestCheckoutBranch {
	command: 'checkoutBranch';
	repo: string;
	branchName: string;
	remoteBranch: string | null;
}
export interface ResponseCheckoutBranch {
	command: 'checkoutBranch';
	status: GitCommandStatus;
}

export interface RequestCheckoutCommit {
	command: 'checkoutCommit';
	repo: string;
	commitHash: string;
}
export interface ResponseCheckoutCommit {
	command: 'checkoutCommit';
	status: GitCommandStatus;
}

export interface RequestCherrypickCommit {
	command: 'cherrypickCommit';
	repo: string;
	commitHash: string;
	parentIndex: number;
	recordOrigin: boolean;
	noCommit: boolean;
}
export interface ResponseCherrypickCommit {
	command: 'cherrypickCommit';
	status: GitCommandStatus;
}

export interface RequestCompareCommits {
	command: 'compareCommits';
	repo: string;
	fromHash: string;
	toHash: string; // commit hash, or "*" for the working tree
}
export interface ResponseCompareCommits {
	command: 'compareCommits';
	fromHash: string;
	toHash: string;
	fileChanges: GitFileChange[] | null;
}

export interface RequestCommitDetails {
	command: 'commitDetails';
	repo: string;
	commitHash: string;
}
export interface ResponseCommitDetails {
	command: 'commitDetails';
	commitDetails: GitCommitDetails | null;
}

export interface RequestCopyToClipboard {
	command: 'copyToClipboard';
	type: string;
	data: string;
}
export interface ResponseCopyToClipboard {
	command: 'copyToClipboard';
	type: string;
	success: boolean;
}

export interface RequestCreateBranch {
	command: 'createBranch';
	repo: string;
	commitHash: string;
	branchName: string;
	checkout: boolean;
}
export interface ResponseCreateBranch {
	command: 'createBranch';
	status: GitCommandStatus;
}

export interface RequestDeleteBranch {
	command: 'deleteBranch';
	repo: string;
	branchName: string;
	forceDelete: boolean;
}
export interface ResponseDeleteBranch {
	command: 'deleteBranch';
	status: GitCommandStatus;
}

export interface RequestDeleteTag {
	command: 'deleteTag';
	repo: string;
	tagName: string;
}
export interface ResponseDeleteTag {
	command: 'deleteTag';
	status: GitCommandStatus;
}

export interface RequestFetchAvatar {
	command: 'fetchAvatar';
	repo: string;
	email: string;
	commits: string[];
}
export interface ResponseFetchAvatar {
	command: 'fetchAvatar';
	email: string;
	image: string;
}

export interface RequestLoadBranches {
	command: 'loadBranches';
	repo: string;
	showRemoteBranches: boolean;
	hard: boolean;
}
export interface ResponseLoadBranches {
	command: 'loadBranches';
	branches: string[];
	head: string | null;
	remotes: string[];
	hard: boolean;
	isRepo: boolean;
}

export interface RequestLoadCommits {
	command: 'loadCommits';
	repo: string;
	branches: string[]; // Branch names, "HEAD", or "--glob=<pattern>" entries; empty => show all
	maxCommits: number;
	showRemoteBranches: boolean;
	hard: boolean;
}
export interface ResponseLoadCommits {
	command: 'loadCommits';
	commits: GitCommitNode[];
	head: string | null;
	moreCommitsAvailable: boolean;
	hard: boolean;
}

export interface RequestLoadRepos {
	command: 'loadRepos';
	check: boolean;
}
export interface ResponseLoadRepos {
	command: 'loadRepos';
	repos: GitRepoSet;
	lastActiveRepo: string | null;
}

export interface RequestMergeBranch {
	command: 'mergeBranch';
	repo: string;
	branchName: string;
	createNewCommit: boolean;
	squash: boolean;
	noCommit: boolean;
}
export interface ResponseMergeBranch {
	command: 'mergeBranch';
	status: GitCommandStatus;
}

export interface RequestMergeCommit {
	command: 'mergeCommit';
	repo: string;
	commitHash: string;
	createNewCommit: boolean;
	squash: boolean;
	noCommit: boolean;
}
export interface ResponseMergeCommit {
	command: 'mergeCommit';
	status: GitCommandStatus;
}

export interface RequestPushTag {
	command: 'pushTag';
	repo: string;
	tagName: string;
}
export interface ResponsePushTag {
	command: 'pushTag';
	status: GitCommandStatus;
}

export interface ResponseSelectRepo {
	command: 'selectRepo';
	repo: string;
}

export interface ResponseRefresh {
	command: 'refresh';
}

export interface RequestRenameBranch {
	command: 'renameBranch';
	repo: string;
	oldName: string;
	newName: string;
}
export interface ResponseRenameBranch {
	command: 'renameBranch';
	status: GitCommandStatus;
}

export interface RequestResetToCommit {
	command: 'resetToCommit';
	repo: string;
	commitHash: string;
	resetMode: GitResetMode;
}
export interface ResponseResetToCommit {
	command: 'resetToCommit';
	status: GitCommandStatus;
}

export interface RequestRevertCommit {
	command: 'revertCommit';
	repo: string;
	commitHash: string;
	parentIndex: number;
}
export interface ResponseRevertCommit {
	command: 'revertCommit';
	status: GitCommandStatus;
}

export interface RequestFetch {
	command: 'fetch';
	repo: string;
	remote: string | null; // null => all remotes
	prune: boolean;
	pruneTags: boolean;
}
export interface ResponseFetch {
	command: 'fetch';
	status: GitCommandStatus;
}

export interface RequestPushBranch {
	command: 'pushBranch';
	repo: string;
	branchName: string;
	remotes: string[]; // the branch is pushed to each remote in turn
	setUpstream: boolean;
	mode: GitPushBranchMode;
}
export interface ResponsePushBranch {
	command: 'pushBranch';
	status: GitCommandStatus;
}

export interface RequestPullBranch {
	command: 'pullBranch';
	repo: string;
	branchName: string;
	remote: string;
	createNewCommit: boolean;
	squash: boolean;
}
export interface ResponsePullBranch {
	command: 'pullBranch';
	status: GitCommandStatus;
}

export interface RequestDeleteRemoteBranch {
	command: 'deleteRemoteBranch';
	repo: string;
	branchName: string;
	remote: string;
}
export interface ResponseDeleteRemoteBranch {
	command: 'deleteRemoteBranch';
	status: GitCommandStatus;
}

export interface RequestFetchIntoLocalBranch {
	command: 'fetchIntoLocalBranch';
	repo: string;
	remote: string;
	remoteBranch: string;
	localBranch: string;
	force: boolean;
}
export interface ResponseFetchIntoLocalBranch {
	command: 'fetchIntoLocalBranch';
	status: GitCommandStatus;
}

export interface RequestRebase {
	command: 'rebase';
	repo: string;
	obj: string;
	type: GitRebaseType;
	ignoreDate: boolean;
	interactive: boolean;
}
export interface ResponseRebase {
	command: 'rebase';
	status: GitCommandStatus;
}

export interface RequestDropCommit {
	command: 'dropCommit';
	repo: string;
	commitHash: string;
}
export interface ResponseDropCommit {
	command: 'dropCommit';
	status: GitCommandStatus;
}

export interface RequestResetUncommittedChanges {
	command: 'resetUncommittedChanges';
	repo: string;
	mode: 'mixed' | 'hard';
}
export interface ResponseResetUncommittedChanges {
	command: 'resetUncommittedChanges';
	status: GitCommandStatus;
}

export interface RequestCleanUntrackedFiles {
	command: 'cleanUntrackedFiles';
	repo: string;
	directories: boolean;
}
export interface ResponseCleanUntrackedFiles {
	command: 'cleanUntrackedFiles';
	status: GitCommandStatus;
}

export interface RequestApplyStash {
	command: 'applyStash';
	repo: string;
	selector: string;
	reinstateIndex: boolean;
}
export interface ResponseApplyStash {
	command: 'applyStash';
	status: GitCommandStatus;
}

export interface RequestPopStash {
	command: 'popStash';
	repo: string;
	selector: string;
	reinstateIndex: boolean;
}
export interface ResponsePopStash {
	command: 'popStash';
	status: GitCommandStatus;
}

export interface RequestDropStash {
	command: 'dropStash';
	repo: string;
	selector: string;
}
export interface ResponseDropStash {
	command: 'dropStash';
	status: GitCommandStatus;
}

export interface RequestBranchFromStash {
	command: 'branchFromStash';
	repo: string;
	selector: string;
	branchName: string;
}
export interface ResponseBranchFromStash {
	command: 'branchFromStash';
	status: GitCommandStatus;
}

export interface RequestPushStash {
	command: 'pushStash';
	repo: string;
	message: string;
	includeUntracked: boolean;
}
export interface ResponsePushStash {
	command: 'pushStash';
	status: GitCommandStatus;
}

export type GitArchiveType = 'zip' | 'tar';
export interface RequestArchive {
	command: 'archive';
	repo: string;
	ref: string; // branch or tag name, or commit hash
}
export interface ResponseArchive {
	command: 'archive';
	status: GitCommandStatus;
}

export interface RequestOpenExternalDiff {
	command: 'openExternalDiff';
	repo: string;
	fromHash: string; // commit hash, or "<hash>^" for the parent of a commit
	toHash: string; // commit hash, or "*" for the working tree
	filePath: string;
}
export interface ResponseOpenExternalDiff {
	command: 'openExternalDiff';
	status: GitCommandStatus;
}

export interface RequestGetRepoSettings {
	command: 'getRepoSettings';
	repo: string;
}
export interface ResponseGetRepoSettings {
	command: 'getRepoSettings';
	settings: GitRepoSettings | null;
}

export interface RequestAddRemote {
	command: 'addRemote';
	repo: string;
	name: string;
	url: string;
	pushUrl: string | null;
	fetch: boolean;
}
export interface ResponseAddRemote {
	command: 'addRemote';
	status: GitCommandStatus;
}

export interface RequestEditRemote {
	command: 'editRemote';
	repo: string;
	nameOld: string;
	nameNew: string;
	url: string;
	pushUrl: string | null;
}
export interface ResponseEditRemote {
	command: 'editRemote';
	status: GitCommandStatus;
}

export interface RequestDeleteRemote {
	command: 'deleteRemote';
	repo: string;
	name: string;
}
export interface ResponseDeleteRemote {
	command: 'deleteRemote';
	status: GitCommandStatus;
}

export interface RequestPruneRemote {
	command: 'pruneRemote';
	repo: string;
	name: string;
}
export interface ResponsePruneRemote {
	command: 'pruneRemote';
	status: GitCommandStatus;
}

export interface RequestSetUserDetails {
	command: 'setUserDetails';
	repo: string;
	name: string;
	email: string;
	useGlobally: boolean;
}
export interface ResponseSetUserDetails {
	command: 'setUserDetails';
	status: GitCommandStatus;
}

export interface RequestOpenExtensionSettings {
	command: 'openExtensionSettings';
}

export interface RequestOpenFile {
	command: 'openFile';
	repo: string;
	filePath: string;
}
export interface ResponseOpenFile {
	command: 'openFile';
	success: boolean;
}

export interface RequestViewFileAtRevision {
	command: 'viewFileAtRevision';
	repo: string;
	commitHash: string;
	filePath: string;
}
export interface ResponseViewFileAtRevision {
	command: 'viewFileAtRevision';
	success: boolean;
}

export interface RequestViewDiffWithWorkingFile {
	command: 'viewDiffWithWorkingFile';
	repo: string;
	commitHash: string;
	filePath: string;
}
export interface ResponseViewDiffWithWorkingFile {
	command: 'viewDiffWithWorkingFile';
	success: boolean;
}

export interface RequestSaveRepoState {
	command: 'saveRepoState';
	repo: string;
	state: GitRepoState;
}

export interface RequestViewDiff {
	command: 'viewDiff';
	repo: string;
	fromHash: string; // commit hash, or "<hash>^" for the parent of a commit
	toHash: string; // commit hash, or "*" for the working tree
	oldFilePath: string;
	newFilePath: string;
	type: GitFileChangeType;
}
export interface ResponseViewDiff {
	command: 'viewDiff';
	success: boolean;
}

export type RequestMessage =
	RequestAddTag
	| RequestApplyStash
	| RequestBranchFromStash
	| RequestCheckoutBranch
	| RequestCheckoutCommit
	| RequestCherrypickCommit
	| RequestCleanUntrackedFiles
	| RequestCommitDetails
	| RequestCompareCommits
	| RequestCopyToClipboard
	| RequestCreateBranch
	| RequestDeleteBranch
	| RequestDeleteRemoteBranch
	| RequestDeleteTag
	| RequestDropCommit
	| RequestDropStash
	| RequestFetch
	| RequestFetchAvatar
	| RequestFetchIntoLocalBranch
	| RequestLoadBranches
	| RequestLoadCommits
	| RequestLoadRepos
	| RequestMergeBranch
	| RequestMergeCommit
	| RequestOpenFile
	| RequestPopStash
	| RequestPullBranch
	| RequestPushBranch
	| RequestPushStash
	| RequestPushTag
	| RequestRebase
	| RequestRenameBranch
	| RequestResetToCommit
	| RequestResetUncommittedChanges
	| RequestRevertCommit
	| RequestSaveRepoState
	| RequestViewDiff
	| RequestArchive
	| RequestGetRepoSettings
	| RequestAddRemote
	| RequestEditRemote
	| RequestDeleteRemote
	| RequestPruneRemote
	| RequestSetUserDetails
	| RequestOpenExtensionSettings
	| RequestOpenExternalDiff
	| RequestViewDiffWithWorkingFile
	| RequestViewFileAtRevision;

export type ResponseMessage =
	ResponseAddTag
	| ResponseApplyStash
	| ResponseBranchFromStash
	| ResponseCheckoutBranch
	| ResponseCheckoutCommit
	| ResponseCherrypickCommit
	| ResponseCleanUntrackedFiles
	| ResponseCommitDetails
	| ResponseCompareCommits
	| ResponseCopyToClipboard
	| ResponseCreateBranch
	| ResponseDeleteBranch
	| ResponseDeleteRemoteBranch
	| ResponseDeleteTag
	| ResponseDropCommit
	| ResponseDropStash
	| ResponseFetch
	| ResponseFetchAvatar
	| ResponseFetchIntoLocalBranch
	| ResponseLoadBranches
	| ResponseLoadCommits
	| ResponseLoadRepos
	| ResponseMergeBranch
	| ResponseMergeCommit
	| ResponseOpenFile
	| ResponsePopStash
	| ResponsePullBranch
	| ResponsePushBranch
	| ResponsePushStash
	| ResponsePushTag
	| ResponseRebase
	| ResponseRefresh
	| ResponseRenameBranch
	| ResponseResetToCommit
	| ResponseResetUncommittedChanges
	| ResponseRevertCommit
	| ResponseSelectRepo
	| ResponseViewDiff
	| ResponseArchive
	| ResponseGetRepoSettings
	| ResponseAddRemote
	| ResponseEditRemote
	| ResponseDeleteRemote
	| ResponsePruneRemote
	| ResponseSetUserDetails
	| ResponseOpenExternalDiff
	| ResponseViewDiffWithWorkingFile
	| ResponseViewFileAtRevision;
