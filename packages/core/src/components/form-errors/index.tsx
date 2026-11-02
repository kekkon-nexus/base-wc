import {
	AttachInternals,
	Component,
	Element,
	Prop,
	Watch,
} from "@stencil/core";

import { warn } from "@/utils/dev";
import {
	addListener,
	afterReset,
	checkValidity,
	namedControl,
} from "@/utils/form";

type Validatable = Element & { setCustomValidity: (message: string) => void };

function isValidatable(element?: Element): element is Validatable {
	return element !== undefined && "setCustomValidity" in element;
}

@Component({
	tag: "base-form-errors",
	encapsulation: { type: "none" },
})
export class FormErrors {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	/** Server errors. Assign a new object: mutating this one is not seen. */
	@Prop({ mutable: true }) errors?: {
		fields?: Record<string, string>;
		form?: string;
	};

	#form?: HTMLFormElement;

	#abort?: AbortController;

	/** The controls holding a key from this element. */
	#controls = new Set<Validatable>();

	#release(control: Validatable): void {
		control.setCustomValidity("");
		this.#controls.delete(control);
		control.dispatchEvent(new Event("base-field-validity", { bubbles: true }));
	}

	#onInput = (event: Event): void => {
		const control = event.target as Validatable;
		if (this.#controls.has(control)) this.#release(control);
	};

	@Watch("errors")
	apply(): void {
		for (const control of this.#controls) this.#release(control);
		this.host.dispatchEvent(new Event("base-form-errors-change"));

		const form = this.#form;
		if (!form) return;
		const { fields = {}, form: formKey } = this.errors ?? {};
		for (const [name, key] of Object.entries(fields)) {
			const control = namedControl(form, name);
			if (isValidatable(control)) {
				control.setCustomValidity(key);
				this.#controls.add(control);
			} else if (__DEV__) {
				warn(`errors.fields names "${name}", which matches no control.`);
			}
		}
		if (this.#controls.size > 0) checkValidity(form);

		if (__DEV__ && formKey) {
			const matches = new Set(
				[...this.host.querySelectorAll("base-form-error")].map(
					(error) => error.getAttribute("match") ?? "",
				),
			);
			if (!matches.has("") && !matches.has(formKey)) {
				warn(`errors.form is "${formKey}", which has no error.`);
			}
		}
	}

	connectedCallback(): void {
		// Chrome leaves an element with no role out of the accessibility tree, and `ariaLive` with it.
		this.internals.role = "group";
		this.internals.ariaLive = "polite";

		this.#form = this.host.closest("form") ?? undefined;
		if (!this.#form) {
			if (__DEV__) warn("<base-form-errors> is not inside a form.");
			return;
		}
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		addListener(this.#form, "input", this.#onInput, { capture: true, signal });
		afterReset(
			this.#form,
			() => {
				this.errors = undefined;
			},
			signal,
		);
		if (this.errors) this.apply();
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#form = undefined;
	}
}
