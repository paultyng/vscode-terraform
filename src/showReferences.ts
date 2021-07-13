import * as vscode from 'vscode';
import {
	ClientCapabilities,
	DocumentSelector,
	ServerCapabilities,
	StaticFeature,
	ReferencesRequest,
	ReferenceContext, 
	BaseLanguageClient} from 'vscode-languageclient';

function ensure<T, K extends keyof T>(target: T, key: K): T[K] {
	if (target[key] === void 0) {
		target[key] = Object.create(null) as any;
	}
	return target[key];
}

type Position = {
	line: number;
	character: number;
}

type RefContext = {
	includeDeclaration: boolean;
}

const showReferencesCommandId = 'client.showReferences'

export class ShowReferencesFeature implements StaticFeature {
	private registeredCommands: vscode.Disposable[] = [];

	constructor(private _client: BaseLanguageClient) {
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
		ensure(capabilities, 'experimental')['showReferencesCommandId'] = showReferencesCommandId;
	};

	public initialize(capabilities: ServerCapabilities, documentSelector: DocumentSelector | undefined): void {
		if ( !capabilities.experimental?.referenceCountCodeLens ) {
			return
		}

		let showRefs = vscode.commands.registerCommand(showReferencesCommandId, async (pos: Position, refCtx: RefContext) => {
			let client = this._client;

			const doc = vscode.window.activeTextEditor.document;

			let position = new vscode.Position(pos.line, pos.character);
			let context: ReferenceContext = {includeDeclaration: refCtx.includeDeclaration}

			let provider: vscode.ReferenceProvider = client.getFeature(ReferencesRequest.method).getProvider(doc);
			let tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();

			let locations = await provider.provideReferences(doc, position, context, tokenSource.token);

			await vscode.commands.executeCommand('editor.action.showReferences', doc.uri, position, locations);
		})
		this.registeredCommands.push(showRefs);
	};
 
	public dispose(): void {
		this.registeredCommands.forEach(function(cmd, index, commands) {
			cmd.dispose();
			commands.splice(index, 1);
		})
	};
}
