import { expect } from "expect";

import { extractRocqComments } from "../../voiceover/commentExtraction";

suite("Voiceover comment extraction", () => {
    test("extracts a single Rocq comment", () => {
        expect(
            extractRocqComments("Check nat. (* Natural numbers. *)"),
        ).toEqual(["Natural numbers."]);
    });

    test("extracts multiple comments", () => {
        expect(
            extractRocqComments("(* First. *) Check nat. (* Second. *)"),
        ).toEqual(["First.", "Second."]);
    });

    test("handles nested comments", () => {
        expect(
            extractRocqComments("(* Outer (* nested detail *) conclusion. *)"),
        ).toEqual(["Outer nested detail conclusion."]);
    });

    test("ignores empty comments", () => {
        expect(extractRocqComments("(*   *) Check nat.")).toEqual([]);
    });

    test("ignores non-comment code", () => {
        expect(
            extractRocqComments("Theorem t : True. Proof. exact I."),
        ).toEqual([]);
    });

    test("removes markdown and code snippets", () => {
        expect(
            extractRocqComments(
                "(* ## Idea\n- Use `iApply H`.\n```coq\nexact I.\n```\nNow finish the proof. *)",
            ),
        ).toEqual(["Idea Now finish the proof."]);
    });

    test("drops separator noise and Rocq code lines", () => {
        expect(
            extractRocqComments(
                "(* --------\nDefinition x := 0.\nThis is the explanation.\n******** *)",
            ),
        ).toEqual(["This is the explanation."]);
    });
});
