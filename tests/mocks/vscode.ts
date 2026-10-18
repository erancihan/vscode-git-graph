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

export const window = {
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
