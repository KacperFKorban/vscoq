export function extractRocqComments(text: string): string[] {
    const comments: string[] = [];
    let depth = 0;
    let commentStart = -1;
    let contentStart = -1;
    let index = 0;

    while (index < text.length) {
        if (text.startsWith("(*", index)) {
            if (depth === 0) {
                commentStart = index;
                contentStart = index + 2;
            }
            depth += 1;
            index += 2;
            continue;
        }

        if (text.startsWith("*)", index) && depth > 0) {
            depth -= 1;
            if (depth === 0) {
                const content = text.slice(contentStart, index);
                const normalized = normalizeRocqComment(content);
                if (normalized.length > 0) {
                    comments.push(normalized);
                }
                commentStart = -1;
                contentStart = -1;
            }
            index += 2;
            continue;
        }

        index += 1;
    }

    if (depth > 0 && commentStart >= 0) {
        const normalized = normalizeRocqComment(text.slice(contentStart));
        if (normalized.length > 0) {
            comments.push(normalized);
        }
    }

    return comments;
}

function normalizeRocqComment(comment: string): string {
    const withoutCode = comment
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`[^`]*`/g, " ")
        .replace(/\[[^\]]+\]\([^)]*\)/g, (match) => {
            const label = match.match(/^\[([^\]]+)\]/);
            return label?.[1] ?? " ";
        })
        .replace(/\(\*/g, "")
        .replace(/\*\)/g, "");

    return withoutCode
        .split(/\r?\n/)
        .map(cleanLine)
        .filter((line) => line.length > 0 && !isNoiseLine(line))
        .filter((line) => !looksLikeRocqCode(line))
        .join(" ")
        .replace(/\s+([.,;:!?])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanLine(line: string): string {
    return line
        .replace(/^\s{0,3}#{1,6}\s+/g, "")
        .replace(/^\s{0,3}>\s?/g, "")
        .replace(/^\s*[-*+]\s+/g, "")
        .replace(/^\s*\d+[.)]\s+/g, "")
        .replace(/[*_~]{1,3}/g, "")
        .trim();
}

function isNoiseLine(line: string): boolean {
    const compact = line.replace(/\s+/g, "");
    if (compact.length === 0) {
        return true;
    }

    if (/^([^\w\s])\1{2,}$/.test(compact)) {
        return true;
    }

    if (/^(?:use|run|execute|try|call|see)[.!?]?$/i.test(compact)) {
        return true;
    }

    const alnum = compact.replace(/[^\p{L}\p{N}]/gu, "").length;
    return compact.length >= 4 && alnum / compact.length < 0.25;
}

function looksLikeRocqCode(line: string): boolean {
    return /^(?:From|Require|Import|Export|Section|End|Context|Variable|Variables|Hypothesis|Hypotheses|Definition|Fixpoint|Lemma|Theorem|Corollary|Example|Proof|Qed|Defined|Abort|Check|Compute|Print|Search|Goal|intros?|intro|apply|exact|reflexivity|rewrite|simpl|iIntros|iApply|iExact|iFrame|iSplit|iDestruct|iMod|iNext|wp_\w+)\b.*\.?$/.test(
        line,
    );
}
