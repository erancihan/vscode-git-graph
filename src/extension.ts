import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { GitGraphView } from './gitGraphView';
import { Logger } from './logger';
import { RepoManager } from './repoManager';
import { StatusBarItem } from './statusBarItem';
import { getPathFromUri } from './utils';

export function activate(context: vscode.ExtensionContext) {
	const logger = new Logger();
	logger.log('Starting Git Graph ...');

	const extensionState = new ExtensionState(context);
	const dataSource = new DataSource(logger);
	const avatarManager = new AvatarManager(dataSource, extensionState, logger);
	const statusBarItem = new StatusBarItem(context);
	const repoManager = new RepoManager(dataSource, extensionState, statusBarItem);

	context.subscriptions.push(
		vscode.commands.registerCommand('git-graph.view', () => {
			let loadRepo: string | null = null;
			if (getConfig().openToTheRepoOfTheActiveTextEditorDocument() && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file') {
				loadRepo = repoManager.getRepoContainingFile(getPathFromUri(vscode.window.activeTextEditor.document.uri));
			}
			GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState, avatarManager, repoManager, logger, loadRepo);
		}),
		vscode.commands.registerCommand('git-graph.addGitRepository', async () => {
			const uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Add Repository', title: 'Select a Git repository to add to Git Graph' });
			if (!uris || uris.length === 0) return;
			const path = getPathFromUri(uris[0]);
			const error = await repoManager.registerRepo(path);
			if (error === null) {
				logger.log('Added repository: ' + path);
				vscode.window.showInformationMessage('The repository "' + path + '" was added to Git Graph.');
			} else {
				vscode.window.showErrorMessage(error);
			}
		}),
		vscode.commands.registerCommand('git-graph.removeGitRepository', async () => {
			const repos = Object.keys(repoManager.getRepos());
			if (repos.length === 0) {
				vscode.window.showInformationMessage('Git Graph does not know any repository in this workspace.');
				return;
			}
			const picked = await vscode.window.showQuickPick(repos.map((path) => ({ label: path.substring(path.lastIndexOf('/') + 1), description: path, path: path })), { placeHolder: 'Select the repository to remove from Git Graph' });
			if (!picked) return;
			repoManager.ignoreRepo(picked.path);
			logger.log('Removed repository: ' + picked.path);
			vscode.window.showInformationMessage('The repository "' + picked.path + '" was removed from Git Graph. Use "Git Graph: Add Git Repository..." to add it again.');
		}),
		vscode.commands.registerCommand('git-graph.clearAvatarCache', () => {
			avatarManager.clearCache();
		}),
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource)),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('git-graph.showStatusBarItem')) {
				statusBarItem.refresh();
			}
			if (e.affectsConfiguration('git-graph.maxDepthOfRepoSearch')) {
				repoManager.maxDepthOfRepoSearchChanged();
			}
			if (e.affectsConfiguration('git.path')) {
				dataSource.registerGitPath();
			}
		}),
		repoManager,
		logger
	);
	logger.log('Started Git Graph - Ready to use!');
}

export function deactivate() { }
