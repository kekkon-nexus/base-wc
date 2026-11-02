import { Component, Element, Prop } from "@stencil/core";

import { warn } from "@/utils/dev";
import { requestSubmit } from "@/utils/form";

@Component({
	tag: "base-otp-field",
	encapsulation: { type: "none" },
})
export class OtpField {
	@Element() host!: HTMLElement;

	/** The number of characters in a full code. */
	@Prop() length = 0;

	/** Submits the form when the code is full and valid. */
	@Prop() autosubmit = false;

	/** Runs before filtering, for example to uppercase. */
	@Prop() normalize?: (value: string) => string;

	#abort?: AbortController;

	/** The last value submitted, so editing back to it does not submit twice. */
	#submitted?: string;

	#clean(input: HTMLInputElement, value: string): string {
		const normalized = this.normalize?.(value) ?? value;
		const kept =
			input.inputMode === "numeric"
				? normalized.replaceAll(/\D/gu, "")
				: normalized.replaceAll(/[^\p{L}\p{N}]/gu, "");
		return this.length > 0 ? kept.slice(0, this.length) : kept;
	}

	#apply(input: HTMLInputElement): void {
		const caret = input.selectionStart ?? input.value.length;
		const before = this.#clean(input, input.value.slice(0, caret));
		const cleaned = this.#clean(input, input.value);
		if (cleaned !== input.value) {
			input.value = cleaned;
			input.setSelectionRange(before.length, before.length);
		}
		if (this.autosubmit) {
			setTimeout(() => {
				this.#submit(input);
			}, 0);
		}
	}

	#submit(input: HTMLInputElement): void {
		const { value, form } = input;
		const held = input.validationMessage === "validating";
		if (value.length !== this.length) {
			this.#submitted = undefined;
		} else if (
			form &&
			value !== this.#submitted &&
			(input.validity.valid || held)
		) {
			this.#submitted = value;
			requestSubmit(form);
		}
	}

	#onInput = (event: Event): void => {
		const input = event.target as HTMLInputElement;
		if (!(event as InputEvent).isComposing) this.#apply(input);
	};

	#onCompositionEnd = (event: Event): void => {
		this.#apply(event.target as HTMLInputElement);
	};

	connectedCallback(): void {
		if (__DEV__ && this.host.querySelector("input[maxlength]")) {
			warn(
				"<base-otp-field> needs no maxlength on its input: it truncates a paste before cleaning.",
			);
		}
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener("input", this.#onInput, {
			capture: true,
			signal,
		});
		this.host.addEventListener("compositionend", this.#onCompositionEnd, {
			signal,
		});
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
