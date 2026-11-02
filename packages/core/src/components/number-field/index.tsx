import { Component, Element } from "@stencil/core";

import { afterReset } from "@/utils/form";

const HOLD_DELAY = 400;
const HOLD_INTERVAL = 60;

const DIRECTIONS = new Map([
	["--step-up", 1],
	["--step-down", -1],
]);

function atLimit(input: HTMLInputElement, direction: number): boolean {
	if (input.value === "") return false;
	const limit = direction > 0 ? input.max : input.min;
	if (limit === "") return false;
	return direction > 0
		? input.valueAsNumber >= Number(limit)
		: input.valueAsNumber <= Number(limit);
}

function step(input: HTMLInputElement, direction: number): void {
	if (input.step !== "any") {
		if (direction > 0) input.stepUp();
		else input.stepDown();
		return;
	}
	const next = (input.valueAsNumber || 0) + direction;
	const lower = input.min === "" ? -Infinity : Number(input.min);
	const upper = input.max === "" ? Infinity : Number(input.max);
	input.value = String(Math.min(Math.max(next, lower), upper));
}

@Component({
	tag: "base-number-field",
	encapsulation: { type: "none" },
})
export class NumberField {
	@Element() host!: HTMLElement;

	#abort?: AbortController;

	#resetAbort?: AbortController;

	#timer?: ReturnType<typeof setTimeout>;

	/** A hold stepped the value, so the click that ends it must not step again. */
	#held = false;

	#mouse = false;

	/** Buttons the field disabled, so one the consumer disabled stays disabled. */
	#disabled = new WeakSet<HTMLButtonElement>();

	#observer = new MutationObserver(() => {
		this.#sync();
	});

	get #input(): HTMLInputElement | null {
		return this.host.querySelector('input[type="number"]');
	}

	#buttons(): [HTMLButtonElement, number][] {
		return [...this.host.querySelectorAll("button")].flatMap((button) => {
			const direction = DIRECTIONS.get(button.getAttribute("command") ?? "");
			return direction === undefined
				? []
				: ([[button, direction]] as [HTMLButtonElement, number][]);
		});
	}

	#sync = (): void => {
		const input = this.#input;
		if (!input) return;
		const locked = input.disabled || input.readOnly;
		for (const [button, direction] of this.#buttons()) {
			const off = locked || atLimit(input, direction);
			if (off && !button.disabled) {
				button.disabled = true;
				this.#disabled.add(button);
			} else if (!off && this.#disabled.delete(button)) {
				button.disabled = false;
			}
		}

		this.#resetAbort?.abort();
		if (input.form) {
			this.#resetAbort = new AbortController();
			afterReset(
				input.form,
				() => {
					this.#sync();
				},
				this.#resetAbort.signal,
			);
		}
	};

	#tick(input: HTMLInputElement, direction: number): void {
		step(input, direction);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}

	#onCommand = (event: Event): void => {
		const direction = DIRECTIONS.get((event as CommandEvent).command);
		const input = this.#input;
		if (direction === undefined || !input || event.target !== input) return;
		if (this.#held) {
			this.#held = false;
			return;
		}
		this.#tick(input, direction);
		input.dispatchEvent(new Event("change", { bubbles: true }));
	};

	#stop(): void {
		clearTimeout(this.#timer);
		clearInterval(this.#timer);
	}

	#pressed(event: Event): [HTMLButtonElement, number] | undefined {
		return this.#buttons().find(
			([button]) =>
				event.target instanceof Node && button.contains(event.target),
		);
	}

	/**
	 * Keeps focus in the input, for mouse presses only so a tap does not open the keyboard. It is
	 * here and not on `pointerdown` since the default action of `mousedown` is what focuses the button.
	 *
	 * @param event the mouse event
	 */
	#onMouseDown = (event: MouseEvent): void => {
		if (!this.#mouse || !this.#pressed(event)) return;
		event.preventDefault();
		this.#input?.focus();
	};

	#onPointerDown = (event: PointerEvent): void => {
		const pressed = this.#pressed(event);
		const input = this.#input;
		if (!pressed || !input || event.button !== 0) return;
		const [, direction] = pressed;

		this.#held = false;
		this.#mouse = event.pointerType === "mouse";

		const release = new AbortController();
		const end = (): void => {
			release.abort();
			this.#stop();
			if (this.#held) {
				input.dispatchEvent(new Event("change", { bubbles: true }));
			}
		};
		for (const type of ["pointerup", "pointercancel"]) {
			document.addEventListener(type, end, { signal: release.signal });
		}

		this.#timer = setTimeout(() => {
			this.#held = true;
			this.#timer = setInterval(() => {
				this.#tick(input, direction);
				if (atLimit(input, direction)) this.#stop();
			}, HOLD_INTERVAL);
		}, HOLD_DELAY);
	};

	connectedCallback(): void {
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener("command", this.#onCommand, {
			capture: true,
			signal,
		});
		this.host.addEventListener("pointerdown", this.#onPointerDown, { signal });
		this.host.addEventListener("mousedown", this.#onMouseDown, { signal });
		this.host.addEventListener("input", this.#sync, { signal });
		this.host.addEventListener("change", this.#sync, { signal });
		this.#observer.observe(this.host, {
			attributes: true,
			attributeFilter: ["min", "max", "disabled", "readonly"],
			childList: true,
			subtree: true,
		});
		this.#sync();
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#resetAbort?.abort();
		this.#observer.disconnect();
		this.#stop();
	}
}
