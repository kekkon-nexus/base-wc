import {
	AttachInternals,
	Component,
	Element,
	Method,
	Prop,
} from "@stencil/core";

import { reveal, swipedAway } from "@/utils/swipe";

type Announcer = HTMLElement & {
	ariaNotify?: (announcement: string) => void;
};

/**
 * One toast, rendered by the consumer. It hides, never removes: a framework keeps its own list,
 * so the toast fires `toggle` and the consumer drops it from state.
 */
@Component({
	tag: "base-toast",
	encapsulation: { type: "none" },
})
export class Toast {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	/** Milliseconds before it hides; 0 never. Defaults to the toaster's, or none with a button inside. */
	@Prop() timeout?: number;

	#abort?: AbortController;

	#timer?: ReturnType<typeof setTimeout>;

	#remaining = 0;

	#started = 0;

	/** @returns the timeout in force, the toaster's when the toast sets none */
	#duration(): number {
		if (this.timeout !== undefined) return this.timeout;
		if (this.host.querySelector("button, a[href], input, select, textarea"))
			return 0;
		const toaster = this.host.closest<HTMLElement & { timeout?: number }>(
			"base-toaster",
		);
		return toaster?.timeout ?? 5000;
	}

	/**
	 * Hides it and fires `toggle`; the consumer removes it.
	 *
	 * @returns a promise that resolves once it is hidden
	 */
	@Method()
	dismiss(): Promise<void> {
		this.#close();
		return Promise.resolve();
	}

	#close(): void {
		if (this.host.hidden) return;
		clearTimeout(this.#timer);
		this.host.hidden = true;
		setTimeout(() => {
			this.host.dispatchEvent(
				new ToggleEvent("toggle", { oldState: "open", newState: "closed" }),
			);
		}, 0);
		this.host
			.closest("base-toaster")
			?.dispatchEvent(new Event("base-toast-change"));
	}

	/**
	 * @param paused whether the toaster is paused, by hover, focus or a hidden page
	 * @returns a promise that resolves once the timer follows
	 */
	@Method()
	pause(paused: boolean): Promise<void> {
		this.#pause(paused);
		return Promise.resolve();
	}

	#pause(paused: boolean): void {
		if (this.#remaining <= 0 || this.host.hidden) return;
		clearTimeout(this.#timer);
		if (paused) {
			this.#remaining -= Date.now() - this.#started;
		} else {
			this.#started = Date.now();
			this.#timer = setTimeout(() => {
				this.#close();
			}, this.#remaining);
		}
	}

	#onCommand = (event: Event): void => {
		if ((event as CommandEvent).command === "--close") this.#close();
	};

	#onScrollEnd = (): void => {
		if (swipedAway(this.host)) this.#close();
	};

	componentDidLoad(): void {
		reveal(this.host, "instant");
		(this.host as Announcer).ariaNotify?.(this.host.textContent.trim());
		this.#remaining = this.#duration();
		if (this.#remaining > 0) this.#pause(false);
	}

	connectedCallback(): void {
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener("command", this.#onCommand, { signal });
		this.host.addEventListener("scrollend", this.#onScrollEnd, { signal });
		this.host.addEventListener(
			"click",
			(event) => {
				const button = (event.target as HTMLElement).closest(
					'[command="--close"]',
				);
				// A close button inside the toast needs no id to point back at it.
				if (button && !button.hasAttribute("commandfor")) this.#close();
			},
			{ signal },
		);
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		clearTimeout(this.#timer);
	}
}
