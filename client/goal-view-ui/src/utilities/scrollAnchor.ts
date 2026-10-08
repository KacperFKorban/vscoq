// Keep the same proof content visible when a new proof state renders.

// Store the old item order and viewport position for the next render.
export type ScrollAnchor = {
    keys: string[];
    index: number;
    top: number;
    scrollTop: number;
};

// List rendered proof items in order, excluding items in hidden panels.
const anchors = () =>
    Array.from(
        document.querySelectorAll<HTMLElement>("[data-proof-anchor]"),
    ).filter((element) => element.getClientRects().length > 0);

// Record the first visible item's identity and position before an update.
export const captureScrollAnchor = (): ScrollAnchor => {
    const elements = anchors();
    const index = elements.findIndex((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
    });

    return {
        keys: elements.map((element) => element.dataset.proofAnchor!),
        index,
        top: index < 0 ? 0 : elements[index].getBoundingClientRect().top,
        scrollTop: document.scrollingElement?.scrollTop ?? 0,
    };
};

// Find the same item, or the next or previous item that still exists.
export const nearbyAnchor = (
    oldKeys: string[],
    index: number,
    newKeys: string[],
) => {
    if (index < 0) return -1;
    const positions = new Map(newKeys.map((key, i) => [key, i]));
    const current = positions.get(oldKeys[index]);
    if (current !== undefined) return current;
    for (let i = index + 1; i < oldKeys.length; i++) {
        const next = positions.get(oldKeys[i]);
        if (next !== undefined) return next;
    }
    for (let i = index - 1; i >= 0; i--) {
        const previous = positions.get(oldKeys[i]);
        if (previous !== undefined) return previous;
    }
    return -1;
};

// Restore the item's screen position and clamp the scroll to the new content.
export const restoreScrollAnchor = (anchor: ScrollAnchor) => {
    const scroller = document.scrollingElement;
    if (!scroller) return;
    const elements = anchors();
    const index = nearbyAnchor(
        anchor.keys,
        anchor.index,
        elements.map((element) => element.dataset.proofAnchor!),
    );
    const sameAnchor =
        index >= 0 &&
        elements[index].dataset.proofAnchor === anchor.keys[anchor.index];
    const top = sameAnchor ? anchor.top : Math.max(0, anchor.top);
    const desired =
        index < 0
            ? anchor.scrollTop
            : scroller.scrollTop +
              elements[index].getBoundingClientRect().top -
              top;
    scroller.scrollTop = Math.max(
        0,
        Math.min(desired, scroller.scrollHeight - scroller.clientHeight),
    );
};
