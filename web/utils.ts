/* Constants */
const vscode = acquireVsCodeApi();
const svgIcons = {
	alert: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z"/></svg>',
	branch: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="16" viewBox="0 0 10 16"><path fill-rule="evenodd" d="M10 5c0-1.11-.89-2-2-2a1.993 1.993 0 0 0-1 3.72v.3c-.02.52-.23.98-.63 1.38-.4.4-.86.61-1.38.63-.83.02-1.48.16-2 .45V4.72a1.993 1.993 0 0 0-1-3.72C.88 1 0 1.89 0 3a2 2 0 0 0 1 1.72v6.56c-.59.35-1 .99-1 1.72 0 1.11.89 2 2 2 1.11 0 2-.89 2-2 0-.53-.2-1-.53-1.36.09-.06.48-.41.59-.47.25-.11.56-.17.94-.17 1.05-.05 1.95-.45 2.75-1.25S8.95 7.77 9 6.73h-.02C9.59 6.37 10 5.73 10 5zM2 1.8c.66 0 1.2.55 1.2 1.2 0 .65-.55 1.2-1.2 1.2C1.35 4.2.8 3.65.8 3c0-.65.55-1.2 1.2-1.2zm0 12.41c-.66 0-1.2-.55-1.2-1.2 0-.65.55-1.2 1.2-1.2.65 0 1.2.55 1.2 1.2 0 .65-.55 1.2-1.2 1.2zm6-8c-.66 0-1.2-.55-1.2-1.2 0-.65.55-1.2 1.2-1.2.65 0 1.2.55 1.2 1.2 0 .65-.55 1.2-1.2 1.2z"/></svg>',
	close: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="16" viewBox="0 0 12 16"><path fill-rule="evenodd" d="M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z"/></svg>',
	info: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M6.3 5.69a.942.942 0 0 1-.28-.7c0-.28.09-.52.28-.7.19-.18.42-.28.7-.28.28 0 .52.09.7.28.18.19.28.42.28.7 0 .28-.09.52-.28.7a1 1 0 0 1-.7.3c-.28 0-.52-.11-.7-.3zM8 7.99c-.02-.25-.11-.48-.31-.69-.2-.19-.42-.3-.69-.31H6c-.27.02-.48.13-.69.31-.2.2-.3.44-.31.69h1v3c.02.27.11.5.31.69.2.2.42.31.69.31h1c.27 0 .48-.11.69-.31.2-.19.3-.42.31-.69H8V7.98v.01zM7 2.3c-3.14 0-5.7 2.54-5.7 5.68 0 3.14 2.56 5.7 5.7 5.7s5.7-2.55 5.7-5.7c0-3.15-2.56-5.69-5.7-5.69v.01zM7 .98c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.12-7-7 3.14-7 7-7z"/></svg>',
	fileTree: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M1 2h4v3H1V2zm2 4h1v7h1v1h4v-2H5v-2h4V8H5V6H3zm5-1h5v2H8V5zm0 4h5v2H8V9zm0 4h5v2H8v-2z"/></svg>',
	fileList: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M1 3h12v2H1V3zm0 4h12v2H1V7zm0 4h12v2H1v-2z"/></svg>',
	gear: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M14 8.77v-1.6l-1.94-.64-.45-1.09.88-1.84-1.13-1.13-1.81.91-1.09-.45-.69-1.92h-1.6l-.63 1.94-1.11.45-1.84-.88-1.13 1.13.91 1.81-.45 1.09L0 7.23v1.59l1.94.64.45 1.09-.88 1.84 1.13 1.13 1.81-.91 1.09.45.69 1.92h1.59l.63-1.94 1.11-.45 1.84.88 1.13-1.13-.92-1.81.47-1.09L14 8.75v.02zM7 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>',
	shield: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M7 1L1 3.5v4c0 3.5 2.6 6.4 6 7.5 3.4-1.1 6-4 6-7.5v-4L7 1zm0 1.3l4.8 2V7.5c0 2.8-2 5.1-4.8 6.2-2.8-1.1-4.8-3.4-4.8-6.2V4.3L7 2.3zm-.7 7.9L4 7.9l.9-.9 1.4 1.4 3-3 .9.9-3.9 3.9z"/></svg>',
	stash: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M1 2h12v3H1V2zm1 4h10v8H2V6zm3 2v1.5h4V8H5z"/></svg>',
	tag: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="16" viewBox="0 0 15 16"><path fill-rule="evenodd" d="M7.73 1.73C7.26 1.26 6.62 1 5.96 1H3.5C2.13 1 1 2.13 1 3.5v2.47c0 .66.27 1.3.73 1.77l6.06 6.06c.39.39 1.02.39 1.41 0l4.59-4.59a.996.996 0 0 0 0-1.41L7.73 1.73zM2.38 7.09c-.31-.3-.47-.7-.47-1.13V3.5c0-.88.72-1.59 1.59-1.59h2.47c.42 0 .83.16 1.13.47l6.14 6.13-4.73 4.73-6.13-6.15zM3.01 3h2v2H3V3h.01z"/></svg>',
	loading: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 12 16"><path fill-rule="evenodd" d="M10.24 7.4a4.15 4.15 0 0 1-1.2 3.6 4.346 4.346 0 0 1-5.41.54L4.8 10.4.5 9.8l.6 4.2 1.31-1.26c2.36 1.74 5.7 1.57 7.84-.54a5.876 5.876 0 0 0 1.74-4.46l-1.75-.34zM2.96 5a4.346 4.346 0 0 1 5.41-.54L7.2 5.6l4.3.6-.6-4.2-1.31 1.26c-2.36-1.74-5.7-1.57-7.85.54C.5 5.03-.06 6.65.01 8.26l1.75.35A4.17 4.17 0 0 1 2.96 5z"/></svg>',
	openFolder: '<svg xmlns="http://www.w3.org/2000/svg" class="openFolderIcon" viewBox="0 0 30 30"><path d="M 5 4 C 3.895 4 3 4.895 3 6 L 3 9 L 3 11 L 22 11 L 27 11 L 27 8 C 27 6.895 26.105 6 25 6 L 12.199219 6 L 11.582031 4.9707031 C 11.221031 4.3687031 10.570187 4 9.8671875 4 L 5 4 z M 2.5019531 13 C 1.4929531 13 0.77040625 13.977406 1.0664062 14.941406 L 4.0351562 24.587891 C 4.2941563 25.426891 5.0692656 26 5.9472656 26 L 15 26 L 24.052734 26 C 24.930734 26 25.705844 25.426891 25.964844 24.587891 L 28.933594 14.941406 C 29.229594 13.977406 28.507047 13 27.498047 13 L 15 13 L 2.5019531 13 z"/></svg>',
	closedFolder: '<svg xmlns="http://www.w3.org/2000/svg" class="closedFolderIcon" viewBox="0 0 30 30"><path d="M 4 3 C 2.895 3 2 3.895 2 5 L 2 8 L 13 8 L 28 8 L 28 7 C 28 5.895 27.105 5 26 5 L 11.199219 5 L 10.582031 3.9707031 C 10.221031 3.3687031 9.5701875 3 8.8671875 3 L 4 3 z M 3 10 C 2.448 10 2 10.448 2 11 L 2 23 C 2 24.105 2.895 25 4 25 L 26 25 C 27.105 25 28 24.105 28 23 L 28 11 C 28 10.448 27.552 10 27 10 L 3 10 z"/></svg>',
	file: '<svg xmlns="http://www.w3.org/2000/svg" class="fileIcon" viewBox="0 0 30 30"><path d="M24.707,8.793l-6.5-6.5C18.019,2.105,17.765,2,17.5,2H7C5.895,2,5,2.895,5,4v22c0,1.105,0.895,2,2,2h16c1.105,0,2-0.895,2-2 V9.5C25,9.235,24.895,8.981,24.707,8.793z M18,10c-0.552,0-1-0.448-1-1V3.904L23.096,10H18z"/></svg>'
};
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const htmlEscapes: { [key: string]: string } = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#x27;', '/': '&#x2F;' };
const htmlUnescapes: { [key: string]: string } = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': '\'', '&#x2F;': '/' };
const htmlEscaper = /[&<>"'\/]/g;
const htmlUnescaper = /&lt;|&gt;|&amp;|&quot;|&#x27;|&#x2F;/g;
const refInvalid = /^[-\/].*|[\\" ><~^:?*[]|\.\.|\/\/|\/\.|@{|[.\/]$|\.lock$|^@$/g;
const ELLIPSIS = '&#8230;';


/* General Helpers */
function arraysEqual<T>(a: T[], b: T[], equalElements: (a: T, b: T) => boolean) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (!equalElements(a[i], b[i])) return false;
	}
	return true;
}
function pad2(i: number) {
	return i > 9 ? i : '0' + i;
}


/* HTML Escape / Unescape */
function escapeHtml(str: string) {
	return str.replace(htmlEscaper, (match) => htmlEscapes[match]);
}
function unescapeHtml(str: string) {
	return str.replace(htmlUnescaper, (match) => htmlUnescapes[match]);
}


/* DOM Helpers */
function addListenerToClass(className: string, event: string, eventListener: EventListener) {
	const elems = document.getElementsByClassName(className);
	for (let i = 0; i < elems.length; i++) {
		elems[i].addEventListener(event, eventListener);
	}
}

/**
 * Listen for `event` on `container` and call `eventListener` when the event target is inside an
 * element with `className`. One listener on the container replaces one listener per element, and it
 * keeps working after the container's content is replaced.
 */
function addDelegatedListener(container: HTMLElement, className: string, event: string, eventListener: EventListener) {
	container.addEventListener(event, (e: Event) => {
		const target = e.target;
		if (target instanceof Element && target.closest('.' + className) !== null) {
			eventListener(e);
		}
	});
}
/** Human readable description of a commit signature status, for tooltips and the details view. */
function describeSignature(signature: GG.GitSignature) {
	const by = signature.signer !== '' ? ' by ' + signature.signer : '', key = signature.key !== '' ? ' (key ' + signature.key + ')' : '';
	switch (signature.status) {
		case 'G': return 'Good signature' + by + key;
		case 'U': return 'Good signature' + by + key + ', but the key is not trusted';
		case 'X': return 'Good signature' + by + key + ', but the signature has expired';
		case 'Y': return 'Good signature' + by + key + ', but the key has expired';
		case 'R': return 'Good signature' + by + key + ', but the key was revoked';
		case 'B': return 'Bad signature' + by + key;
		case 'E': return 'The signature could not be checked' + key;
		default: return 'Not signed';
	}
}
/** Icon shown next to the commit hash when signature status is enabled. Unsigned commits get no icon. */
function signatureIconHtml(signature: GG.GitSignature | null | undefined) {
	if (!signature || signature.status === 'N') return ''; // undefined: state written by versions without signature status
	return '<span class="signatureStatus ' + signature.status + '" title="' + escapeHtml(describeSignature(signature)) + '">' + svgIcons.shield + '</span>';
}

/** Compiled issue linking pattern of the current repository, or null. Invalid patterns are ignored. */
function compileIssueLinking(config: GG.IssueLinkingConfig | null): { regex: RegExp, url: string } | null {
	if (config === null || config.issue === '' || !/^https?:\/\//i.test(config.url)) return null;
	try {
		return { regex: new RegExp(config.issue, 'g'), url: config.url };
	} catch (e) {
		return null;
	}
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)]/g;

/**
 * Escapes a commit message for HTML and turns issue references (per the repository configuration) and
 * http(s) URLs into clickable links. Links carry the target in data-url; a delegated click handler
 * asks the extension to open it.
 */
function linkifyMessage(message: string, issueLinking: { regex: RegExp, url: string } | null, linkUrls: boolean) {
	type Link = { start: number, end: number, url: string };
	const links: Link[] = [];
	if (issueLinking !== null) {
		issueLinking.regex.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = issueLinking.regex.exec(message)) !== null) {
			if (match[0] === '') { issueLinking.regex.lastIndex++; continue; }
			const groups = match;
			const url = issueLinking.url.replace(/\$(\d+)/g, (_, index) => encodeURIComponent(groups[parseInt(index)] || ''));
			links.push({ start: match.index, end: match.index + match[0].length, url: url });
		}
	}
	if (linkUrls) {
		URL_IN_TEXT.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = URL_IN_TEXT.exec(message)) !== null) {
			const start = match.index, end = start + match[0].length;
			if (!links.some((link) => start < link.end && end > link.start)) links.push({ start: start, end: end, url: match[0] });
		}
	}
	if (links.length === 0) return escapeHtml(message);
	links.sort((a, b) => a.start - b.start);
	let html = '', position = 0;
	for (const link of links) {
		if (link.start < position) continue; // overlapping issue matches: keep the first
		html += escapeHtml(message.substring(position, link.start));
		html += '<span class="externalLink" data-url="' + escapeHtml(link.url) + '" title="' + escapeHtml(link.url) + '">' + escapeHtml(message.substring(link.start, link.end)) + '</span>';
		position = link.end;
	}
	return html + escapeHtml(message.substring(position));
}

function insertAfter(newNode: HTMLElement, referenceNode: HTMLElement) {
	referenceNode.parentNode!.insertBefore(newNode, referenceNode.nextSibling);
}


/* VSCode Helpers */
function sendMessage(msg: GG.RequestMessage) {
	vscode.postMessage(msg);
}
function getVSCodeStyle(name: string) {
	return document.documentElement.style.getPropertyValue(name);
}