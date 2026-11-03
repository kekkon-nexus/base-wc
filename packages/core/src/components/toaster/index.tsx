import { Component, Element, Method, Prop } from "@stencil/core";

type ToastElement = HTMLElement & { pause: (paused: boolean) => Promise<void> };

/** The region toasts stack in, in the top layer while any is shown. */
@Component({
	tag: "base-toaster",
	encapsulation: { type: "none" },
})
export class Toaster {
	@Element() host!: HTMLElement;

	/** Milliseconds before a toast hides; 0 never. */
	@Prop() timeout = 5000;

	/** Toasts shown at once; older ones beyond it get `:state(limited)`. */
	@Prop() limit = 3;

	#abort?: AbortController;

	#hovered = false;

	#focused = false;

	#observer = new MutationObserver(() => {
		this.#sync();
	});

	#toasts(): ToastElement[] {
		return [
			...this.host.querySelectorAll<ToastElement>(":scope > base-toast"),
		].filter((toast) => !toast.hidden);
	}

	#sync = (): void => {
		const toasts = this.#toasts();
		const open = this.host.matches(":popover-open");
		if (toasts.length > 0 && !open) this.host.showPopover();
		else if (toasts.length === 0 && open) this.host.hidePopover();
		const limited = toasts.length - this.limit;
		for (const [index, toast] of toasts.entries()) {
			const internals = (
				toast as ToastElement & { internals?: ElementInternals }
			).internals;
			if (index < limited) internals?.states.add("limited");
			else internals?.states.delete("limited");
		}
	};

	#pause(): void {
		const paused = this.#hovered || this.#focused || document.hidden;
		for (const toast of this.#toasts()) toast.pause(paused).catch(reportError);
	}

	/**
	 * Adds a toast the page built, for plain script; frameworks render toasts themselves.
	 *
	 * @param toast a `base-toast`
	 * @returns a promise that resolves once it is added
	 */
	@Method()
	show(toast: HTMLElement): Promise<void> {
		this.host.append(toast);
		return Promise.resolve();
	}

	connectedCallback(): void {
		if (!this.host.hasAttribute("popover"))
			this.host.setAttribute("popover", "manual");
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		const on = (
			type: string,
			listener: () => void,
			target: EventTarget = this.host,
		): void => {
			target.addEventListener(type, listener, { signal });
		};
		on("pointerenter", () => {
			this.#hovered = true;
			this.#pause();
		});
		on("pointerleave", () => {
			this.#hovered = false;
			this.#pause();
		});
		on("focusin", () => {
			this.#focused = true;
			this.#pause();
		});
		on("focusout", () => {
			this.#focused = false;
			this.#pause();
		});
		on(
			"visibilitychange",
			() => {
				this.#pause();
			},
			document,
		);
		on("base-toast-change", this.#sync);
		this.#observer.observe(this.host, { childList: true });
		this.#sync();
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#observer.disconnect();
	}
}
