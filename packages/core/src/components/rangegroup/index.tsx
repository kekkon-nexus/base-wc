import {
	AttachInternals,
	Component,
	Element,
	Method,
	Prop,
	Watch,
} from "@stencil/core";

import { afterReset } from "@/utils/form";

function clamp(value: number, lower: number, upper: number): number {
	return Math.min(Math.max(value, lower), upper);
}

/** A stand-in for `<rangegroup>`: delete it or make it a polyfill once that ships. */
@Component({
	tag: "base-rangegroup",
	encapsulation: { type: "none" },
})
export class Rangegroup {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	/** Passed to inputs that omit `min`. */
	@Prop() min = 0;

	/** Passed to inputs that omit `max`. */
	@Prop() max = 100;

	/** The minimum distance between adjacent thumbs. */
	@Prop({ attribute: "stepbetween" }) stepBetween = 0;

	/** Disables every thumb. */
	@Prop() disabled = false;

	/** @returns the thumbs, in document order */
	@Prop()
	get inputs(): HTMLInputElement[] {
		return [
			...this.host.querySelectorAll<HTMLInputElement>('input[type="range"]'),
		];
	}

	/** @returns every thumb's value, in document order */
	@Prop()
	get values(): number[] {
		return this.inputs.map((input) => input.valueAsNumber);
	}

	#abort?: AbortController;

	#resetAbort?: AbortController;

	#observer = new MutationObserver(() => {
		this.#sync();
	});

	/** Attributes the group wrote, so `min`, `max` and `disabled` can follow it. */
	#inherited = new WeakMap<HTMLInputElement, Set<string>>();

	#inherit(input: HTMLInputElement, name: string, value: string): void {
		const names = this.#inherited.get(input) ?? new Set();
		this.#inherited.set(input, names);
		if (input.hasAttribute(name) && !names.has(name)) return;
		input.setAttribute(name, value);
		names.add(name);
	}

	#fit(input: HTMLInputElement, target = input.valueAsNumber): void {
		const { inputs, min, max, stepBetween } = this;
		const index = inputs.indexOf(input);
		const previous = inputs[index - 1]?.valueAsNumber;
		const next = inputs[index + 1]?.valueAsNumber;
		const lower = Math.max(
			min,
			previous === undefined ? min : previous + stepBetween,
		);
		const upper = Math.min(max, next === undefined ? max : next - stepBetween);
		input.value = String(clamp(target, lower, upper));
		// `value` rounds to the input's `step`, which can land past the neighbor.
		if (input.valueAsNumber < lower) input.stepUp();
		if (input.valueAsNumber > upper) input.stepDown();
	}

	#paint = (): void => {
		const { min, max } = this;
		for (const [index, value] of this.values.entries()) {
			this.host.style.setProperty(
				`--base-rangegroup-thumb-${String(index + 1)}`,
				`${String(((value - min) / (max - min)) * 100)}%`,
			);
		}
	};

	#sync(): void {
		const { inputs } = this;
		for (const input of inputs) {
			this.#inherit(input, "min", String(this.min));
			this.#inherit(input, "max", String(this.max));
			const owned = this.#inherited.get(input);
			if (this.disabled) {
				this.#inherit(input, "disabled", "");
			} else if (owned?.delete("disabled")) {
				input.removeAttribute("disabled");
			}
		}
		this.#paint();

		this.#resetAbort?.abort();
		const form = inputs[0]?.form;
		if (form) {
			this.#resetAbort = new AbortController();
			afterReset(form, this.#paint, this.#resetAbort.signal);
		}
	}

	@Watch("min")
	@Watch("max")
	@Watch("disabled")
	onChange(): void {
		this.#sync();
	}

	#onInput = (event: Event): void => {
		const input = event.target as HTMLInputElement;
		if (!this.inputs.includes(input)) return;
		this.#fit(input);
		this.#paint();
	};

	/**
	 * ponytail: maps the pointer over the whole element, while a native thumb stops half its
	 * width short of each end, so a press near an end lands a few pixels off. Measure the thumb
	 * if that shows.
	 *
	 * @param event the pointer event
	 * @returns the value under the pointer
	 */
	#valueAt(event: PointerEvent): number {
		const { left, top, width, height } = this.host.getBoundingClientRect();
		const { direction, writingMode } = getComputedStyle(this.host);
		const fraction = writingMode.startsWith("vertical")
			? (event.clientY - top) / height
			: (event.clientX - left) / width;
		const position = clamp(direction === "rtl" ? 1 - fraction : fraction, 0, 1);
		return this.min + (this.max - this.min) * position;
	}

	#nearest(value: number): HTMLInputElement | undefined {
		const distance = (input: HTMLInputElement): number =>
			Math.abs(input.valueAsNumber - value);
		let nearest: HTMLInputElement | undefined;
		for (const input of this.inputs.filter(({ disabled }) => !disabled)) {
			if (
				!nearest ||
				distance(input) < distance(nearest) ||
				// Thumbs on the same value: only the later one can move up.
				(distance(input) === distance(nearest) && value > input.valueAsNumber)
			) {
				nearest = input;
			}
		}
		return nearest;
	}

	#onPointerDown = (event: PointerEvent): void => {
		const thumbs: EventTarget[] = this.inputs;
		if (event.button !== 0 || (event.target && thumbs.includes(event.target))) {
			return;
		}
		const input = this.#nearest(this.#valueAt(event));
		if (!input) return;
		event.preventDefault();

		const move = (moved: PointerEvent): void => {
			this.#fit(input, this.#valueAt(moved));
			input.dispatchEvent(new Event("input", { bubbles: true }));
		};
		move(event);
		input.focus({ preventScroll: true });

		const { pointerId } = event;
		this.host.setPointerCapture(pointerId);
		const release = new AbortController();
		const { signal } = release;
		this.host.addEventListener("pointermove", move, { signal });
		for (const type of ["pointerup", "pointercancel"]) {
			this.host.addEventListener(
				type,
				() => {
					release.abort();
					input.dispatchEvent(new Event("change", { bubbles: true }));
				},
				{ signal },
			);
		}
	};

	/**
	 * @param index the thumb's position in document order
	 * @returns the thumb
	 */
	@Method()
	getRangeInput(index: number): Promise<HTMLInputElement | undefined> {
		return Promise.resolve(this.inputs[index]);
	}

	/**
	 * @param index the thumb's position in document order
	 * @param value the value to set, kept between its neighbors
	 * @returns a promise that resolves once it is set
	 */
	@Method()
	setRangeValue(index: number, value: number): Promise<void> {
		const input = this.inputs[index];
		if (input) {
			this.#fit(input, value);
			this.#paint();
		}
		return Promise.resolve();
	}

	connectedCallback(): void {
		this.internals.role = "group";
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener("input", this.#onInput, {
			capture: true,
			signal,
		});
		this.host.addEventListener("pointerdown", this.#onPointerDown, { signal });
		this.#observer.observe(this.host, { childList: true, subtree: true });
		this.#sync();
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#resetAbort?.abort();
		this.#observer.disconnect();
	}
}
