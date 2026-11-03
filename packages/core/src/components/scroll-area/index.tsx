import { AttachInternals, Component, Element } from "@stencil/core";

import { setState } from "@/components/field/control";

/** Fractional scroll positions can stop a pixel short of an edge. */
const EDGE = 1;

interface Edges {
	top: boolean;
	right: boolean;
	bottom: boolean;
	left: boolean;
}

/** A stand-in for scroll-state `scrollable` queries: delete it once they ship everywhere. */
@Component({
	tag: "base-scroll-area",
	encapsulation: { type: "none" },
})
export class ScrollArea {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	#abort?: AbortController;

	#resize = new ResizeObserver(() => {
		this.#update();
	});

	#mutation = new MutationObserver(() => {
		this.#observe();
		this.#update();
	});

	/**
	 * The scroll origin sits at the inline or block start, so an axis whose start is on the right
	 * or bottom counts `scrollLeft` or `scrollTop` from 0 down to negative.
	 *
	 * @param vertical whether the writing mode is vertical
	 * @param rtl whether the direction is right to left
	 * @param writingMode the computed writing mode
	 * @returns which physical edges can still be scrolled towards
	 */
	#edges(vertical: boolean, rtl: boolean, writingMode: string): Edges {
		const {
			scrollLeft,
			scrollTop,
			scrollWidth,
			scrollHeight,
			clientWidth,
			clientHeight,
		} = this.host;
		const maxX = scrollWidth - clientWidth;
		const maxY = scrollHeight - clientHeight;
		const xFromRight = vertical ? writingMode.endsWith("rl") : rtl;
		const yFromBottom = vertical && rtl;
		const x = xFromRight ? scrollLeft + maxX : scrollLeft;
		const y = yFromBottom ? scrollTop + maxY : scrollTop;
		return {
			left: x > EDGE,
			right: x < maxX - EDGE,
			top: y > EDGE,
			bottom: y < maxY - EDGE,
		};
	}

	#update = (): void => {
		const { writingMode, direction } = getComputedStyle(this.host);
		const vertical = !writingMode.startsWith("horizontal");
		const rtl = direction === "rtl";
		const edges = this.#edges(vertical, rtl, writingMode);

		let blockStart: boolean,
			blockEnd: boolean,
			inlineStart: boolean,
			inlineEnd: boolean;
		if (vertical) {
			[blockStart, blockEnd] = writingMode.endsWith("rl")
				? [edges.right, edges.left]
				: [edges.left, edges.right];
			// `sideways-lr` runs its inline axis bottom to top.
			const upward = (writingMode === "sideways-lr") !== rtl;
			[inlineStart, inlineEnd] = upward
				? [edges.bottom, edges.top]
				: [edges.top, edges.bottom];
		} else {
			[blockStart, blockEnd] = [edges.top, edges.bottom];
			[inlineStart, inlineEnd] = rtl
				? [edges.right, edges.left]
				: [edges.left, edges.right];
		}
		setState(this.internals, "scrollable-block-start", blockStart);
		setState(this.internals, "scrollable-block-end", blockEnd);
		setState(this.internals, "scrollable-inline-start", inlineStart);
		setState(this.internals, "scrollable-inline-end", inlineEnd);
	};

	/** Overflow also changes when the element or its content resizes, with no scroll event. */
	#observe(): void {
		this.#resize.disconnect();
		this.#resize.observe(this.host);
		for (const child of this.host.children) this.#resize.observe(child);
	}

	connectedCallback(): void {
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener(
			"scroll",
			() => {
				setState(this.internals, "scrolling", true);
				this.#update();
			},
			{ passive: true, signal },
		);
		this.host.addEventListener(
			"scrollend",
			() => {
				setState(this.internals, "scrolling", false);
			},
			{ signal },
		);
		this.#mutation.observe(this.host, { childList: true });
		this.#observe();
		this.#update();
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#resize.disconnect();
		this.#mutation.disconnect();
	}
}
