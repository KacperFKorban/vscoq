import {
    CodeLens,
    CodeLensProvider,
    Event,
    EventEmitter,
    Position,
    Range,
    TextDocument,
    Uri,
    workspace,
} from "vscode";

import { DocumentProofsResponse } from "./protocol/types";

const REVIEW_COMMAND = "extension.rocq.llm.reviewLemma";

type ProofBlock = DocumentProofsResponse["proofs"][number];

export default class LlmCodeLensProvider implements CodeLensProvider {
    private _onDidChangeCodeLenses = new EventEmitter<void>();

    public readonly onDidChangeCodeLenses: Event<void> =
        this._onDidChangeCodeLenses.event;

    constructor(
        private getDocumentProofs: (
            uri: Uri,
        ) => Promise<DocumentProofsResponse>,
    ) {}

    public refresh() {
        this._onDidChangeCodeLenses.fire();
    }

    public async provideCodeLenses(
        document: TextDocument,
    ): Promise<CodeLens[]> {
        const config = workspace.getConfiguration("vsrocq.llmCodeLens");
        if (!config.get<boolean>("enable", true)) {
            return [];
        }

        let response: DocumentProofsResponse;
        try {
            response = await this.getDocumentProofs(document.uri);
        } catch {
            return [];
        }

        return response.proofs.filter(isAdmittedProof).map((proof) => {
            const range = toRange(proof.statement.range);
            return new CodeLens(range, {
                title: "Ask LLM to review lemma",
                command: REVIEW_COMMAND,
                arguments: [proof.statement.statement, document.uri, range],
            });
        });
    }
}

export function buildReviewPrompt(statement: string): string {
    return `You are reviewing an in-progress Rocq/Coq lemma statement.

Decide whether the statement seems valid, likely false, underspecified, or missing premises. If it seems likely false, suggest a counterexample or the missing assumptions. Be concise and do not attempt a full proof unless needed.

Lemma statement:

\`\`\`coq
${statement.trim()}
\`\`\``;
}

function isAdmittedProof(proof: ProofBlock): boolean {
    const lastStep = proof.steps[proof.steps.length - 1];
    return (
        lastStep !== undefined && /^Admitted\.$/i.test(lastStep.tactic.trim())
    );
}

function toRange(range: Range): Range {
    return new Range(
        new Position(range.start.line, range.start.character),
        new Position(range.end.line, range.end.character),
    );
}
