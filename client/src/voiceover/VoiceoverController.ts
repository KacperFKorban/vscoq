import {
    ConfigurationTarget,
    Disposable,
    Position,
    Range,
    TextDocument,
    window,
    workspace,
} from "vscode";
import say = require("say");

import { extractRocqComments } from "./commentExtraction";

type PendingStep = {
    uri: string;
    start: Position;
};

export class VoiceoverController implements Disposable {
    private readonly channel = window.createOutputChannel("VsRocq Voiceover");
    private processedEndByUri = new Map<string, Position>();
    private pendingStep: PendingStep | undefined;
    private hasShownSpeakError = false;

    public dispose() {
        this.stop();
        this.channel.dispose();
    }

    public get enabled(): boolean {
        return workspace.getConfiguration("vsrocq.voiceover").enabled === true;
    }

    public async toggle() {
        const enabled = !this.enabled;
        await workspace
            .getConfiguration("vsrocq.voiceover")
            .update("enabled", enabled, ConfigurationTarget.Global);

        if (enabled) {
            this.log("enabled");
            window.showInformationMessage("Rocq tutorial voiceover enabled.");
        } else {
            this.stop();
            this.log("disabled");
            window.showInformationMessage("Rocq tutorial voiceover disabled.");
        }
    }

    public recordStepStart(document: TextDocument) {
        if (!this.enabled) {
            this.log("step start ignored: voiceover disabled");
            return;
        }

        const uri = document.uri.toString();
        const start = this.processedEndByUri.get(uri) ?? new Position(0, 0);
        this.pendingStep = {
            uri,
            start,
        };
        this.log(
            `step start recorded from processed overlay: ${uri} @ ${start.line}:${start.character}`,
        );
    }

    public observeProcessedRanges(
        uri: string,
        ranges: Range[],
        document: TextDocument | undefined,
    ) {
        const processedEnd = this.maxRangeEnd(ranges);
        if (processedEnd === undefined) {
            return;
        }

        this.processedEndByUri.set(uri, processedEnd);

        if (!this.enabled || this.pendingStep === undefined) {
            return;
        }

        if (document === undefined) {
            this.log(`overlay ignored: no visible editor for ${uri}`);
            return;
        }

        if (this.speakProcessedDelta(document, processedEnd)) {
            this.pendingStep = undefined;
        }
    }

    private speakProcessedDelta(
        document: TextDocument,
        end: Position,
    ): boolean {
        if (!this.enabled || this.pendingStep === undefined) {
            this.log(
                `overlay ignored: enabled=${this.enabled}, pending=${this.pendingStep !== undefined}`,
            );
            return false;
        }

        const pendingStep = this.pendingStep;

        if (pendingStep.uri !== document.uri.toString()) {
            this.log(
                `overlay ignored: uri mismatch ${pendingStep.uri} != ${document.uri.toString()}`,
            );
            return true;
        }

        const startOffset = document.offsetAt(pendingStep.start);
        const endOffset = document.offsetAt(end);
        if (endOffset <= startOffset) {
            this.log(
                `overlay ignored: non-forward range ${startOffset} -> ${endOffset}`,
            );
            return false;
        }

        const text = document.getText().slice(startOffset, endOffset);
        const comments = extractRocqComments(text);
        if (comments.length === 0) {
            this.log(
                `no comments found in stepped text (${startOffset} -> ${endOffset}): ${JSON.stringify(text)}`,
            );
            return true;
        }

        this.log(
            `speaking ${comments.length} comment(s): ${comments.join(" ")}`,
        );
        this.speak(comments.join(" "));
        return true;
    }

    public stop() {
        this.pendingStep = undefined;
        say.stop();
    }

    private speak(text: string) {
        const config = workspace.getConfiguration("vsrocq.voiceover");
        const configuredVoice = config.get<string>("voice", "").trim();
        const voice = configuredVoice.length > 0 ? configuredVoice : undefined;
        const speed = config.get<number>("speed", 1);

        this.log(
            `say.speak invoked with voice=${voice ?? "default"}, speed=${speed}`,
        );
        say.stop();
        say.speak(text, voice, speed, (err) => {
            if (err !== null && err !== undefined && !this.hasShownSpeakError) {
                this.hasShownSpeakError = true;
                this.log(`say.speak error: ${err}`);
                window.showErrorMessage(
                    `Rocq tutorial voiceover could not speak: ${err}`,
                );
            } else {
                this.log("say.speak completed");
            }
        });
    }

    private log(message: string) {
        this.channel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }

    private maxRangeEnd(ranges: Range[]): Position | undefined {
        let maxEnd: Position | undefined;

        for (const range of ranges) {
            const end = new Position(range.end.line, range.end.character);
            if (maxEnd === undefined || comparePositions(end, maxEnd) > 0) {
                maxEnd = end;
            }
        }

        return maxEnd;
    }
}

function comparePositions(left: Position, right: Position): number {
    if (left.line !== right.line) {
        return left.line - right.line;
    }

    return left.character - right.character;
}
