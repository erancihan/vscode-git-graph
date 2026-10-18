/**
 * Minimal stand-in for the `vscode` module. Tests run outside of Visual Studio Code, so only the
 * parts of the API that the extension touches at module load or in the code under test exist here.
 */

export type ConfigurationValues = { [section: string]: { [key: string]: unknown } };

/** Values returned by `workspace.getConfiguration(section).get(key)`. Tests may replace entries. */
export const configurationValues: ConfigurationValues = {};

/** Lines written to Output Channels, keyed by channel name. */
export const outputChannelLines: { [name: string]: string[] } = {};

export const workspace = {
	getConfiguration(section: string) {
		return {
			get<T>(key: string, defaultValue?: T): T | undefined {
				const values = configurationValues[section];
				if (values && Object.prototype.hasOwnProperty.call(values, key)) return values[key] as T;
				return defaultValue;
			},
			inspect<T>(key: string): { key: string, globalValue?: T } | undefined {
				const values = configurationValues[section];
				if (values && Object.prototype.hasOwnProperty.call(values, key)) return { key, globalValue: values[key] as T };
				return { key };
			}
		};
	}
};

/** Messages shown with window.show*Message, for assertions. */
export const shownMessages: string[] = [];

export const authentication = {
	getSession: async (): Promise<undefined> => undefined
};

export const l10n = {
	t(key: string, ...args: (string | number)[]) {
		return key.replace(/\{(\d+)\}/g, (match, index) => typeof args[parseInt(index)] !== 'undefined' ? String(args[parseInt(index)]) : match);
	}
};

export const window = {
	showInputBox: async (): Promise<string | undefined> => undefined,
	showWarningMessage(message: string) { shownMessages.push(message); return Promise.resolve(undefined); },
	showInformationMessage(message: string) { shownMessages.push(message); return Promise.resolve(undefined); },
	showErrorMessage(message: string) { shownMessages.push(message); return Promise.resolve(undefined); },
	createOutputChannel(name: string) {
		outputChannelLines[name] = outputChannelLines[name] || [];
		return {
			name,
			appendLine(line: string) { outputChannelLines[name].push(line); },
			show() { },
			dispose() { }
		};
	}
};

export class Uri {
	public static file(path: string) { return { fsPath: path, scheme: 'file' }; }
}
