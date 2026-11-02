import { AttachInternals, Component, Element, Prop } from "@stencil/core";

import {
	type Control,
	EVENTS,
	getControl,
	setState,
} from "@/components/field/control";
import { warn, warnMissingErrors } from "@/utils/dev";
import { requestSubmit } from "@/utils/form";
import { focusFirstInvalid, mayFocus } from "@/utils/invalid-focus";
import { addSubmitCheck } from "@/utils/submit-checks";
import { RESERVED_KEYS } from "@/utils/validity";

const VALIDATING = "validating";

@Component({
	tag: "base-field",
	encapsulation: { type: "none" },
})
export class Field {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	/** Returns the key the value fails, or `null`. Pass `signal` on to `fetch`. */
	@Prop() validate?: (
		value: string,
		options: { signal: AbortSignal },
	) => string | null | undefined | Promise<string | null | undefined>;

	/** When `validate` runs. */
	@Prop({ attribute: "validateon" }) validateOn: "input" | "blur" | "submit" =
		"input";

	/** Milliseconds to wait after typing before `validate` runs, for `validateOn="input"`. */
	@Prop({ attribute: "validatedelay" }) validateDelay = 0;

	/** The consumer wires ARIA on the control: field writes none. */
	@Prop({ attribute: "manualaria" }) manualAria = false;

	#abort?: AbortController;

	/** `dirty` compares against the value the control had when the field first saw it. */
	#initial = new WeakMap<Control, string>();

	#linked?: Control;

	#observer = new MutationObserver(() => {
		this.#update();
	});

	/** Set by any `invalid` event, which also covers a `checkValidity()` that `:user-invalid` ignores. */
	#reported = false;

	#run?: AbortController;

	/** A submit was blocked by this field's `validating`. */
	#attempted = false;

	/** The value of the latest run, and the key it resolved to. */
	#checked?: string;

	#key?: string;

	/** The custom message field last wrote, to tell it from a consumer's or form's. */
	#written = "";

	#removeSubmitCheck?: () => void;

	/**
	 * Leaves a custom message field did not write: it is a consumer's or form's until they clear it.
	 *
	 * @param control the control to write on
	 * @param message the custom validity message
	 */
	#write(control: Control, message: string): void {
		if (
			control.validity.customError &&
			control.validationMessage !== this.#written
		) {
			return;
		}
		control.setCustomValidity(message);
		this.#written = message;
	}

	#notify(): void {
		this.host.dispatchEvent(new Event("base-field-validity"));
	}

	async #check(control: Control): Promise<boolean> {
		if (!this.validate) return true;
		this.#run?.abort();
		const run = new AbortController();
		this.#run = run;
		this.#checked = control.value;
		this.#key = undefined;
		setState(this.internals, VALIDATING, true);
		this.#write(control, VALIDATING);
		this.#notify();

		if (this.validateOn === "input" && this.validateDelay > 0) {
			await new Promise((resolve) => {
				setTimeout(resolve, this.validateDelay);
			});
			if (run.signal.aborted) return false;
		}

		let key: string | undefined;
		try {
			const result = await this.validate(control.value, {
				signal: run.signal,
			});
			if (result) key = result;
		} catch (error) {
			if (run.signal.aborted) return false;
			this.#settle(control);
			throw error;
		}
		if (run.signal.aborted) return false;

		this.#settle(control, key);
		const attempted = this.#attempted;
		this.#attempted = false;
		if (key !== undefined) {
			if (attempted) control.checkValidity();
			return false;
		}
		const { form } = control;
		if (attempted && form && mayFocus(form)) requestSubmit(form);
		return true;
	}

	#settle(control: Control, key?: string): void {
		this.#run = undefined;
		this.#key = key;
		setState(this.internals, VALIDATING, false);
		this.#write(control, key ?? "");
		this.#notify();
	}

	#trigger(control: Control, type: string): void {
		if (!this.validate) return;
		if (this.validateOn === "submit") {
			if (type === "input") {
				this.#run?.abort();
				if (this.#run) {
					this.#run = undefined;
					setState(this.internals, VALIDATING, false);
				}
				this.#write(
					control,
					control.value === this.#checked ? (this.#key ?? "") : "",
				);
				this.#notify();
			}
			return;
		}
		const fires =
			this.validateOn === "input"
				? type === "input"
				: type === "change" || type === "focusout";
		if (fires && control.value !== this.#checked) {
			this.#check(control).catch(reportError);
		}
	}

	#link(control: Control): void {
		if (control === this.#linked) return;
		this.#linked = control;
		if (__DEV__) warnMissingErrors(this.host, control);
		if (!this.manualAria) {
			const parts = [
				this.host.querySelector("base-field-description"),
				this.host.querySelector("base-field-errors"),
			].filter((part) => part !== null);
			if (parts.length > 0) control.ariaDescribedByElements = parts;
		}

		this.#removeSubmitCheck?.();
		this.#removeSubmitCheck = control.form
			? addSubmitCheck(control.form, {
					stale: () =>
						this.validateOn === "submit" &&
						this.validate !== undefined &&
						control.value !== this.#checked,
					check: async () => {
						const passed = await this.#check(control);
						if (!passed && this.#key !== undefined) control.checkValidity();
						return passed;
					},
				})
			: undefined;
	}

	#update = (event?: Event): void => {
		const control = getControl(this.host);
		if (!control) return;
		if (!this.#initial.has(control)) this.#initial.set(control, control.value);

		this.#link(control);

		if (event?.type === "invalid") {
			event.preventDefault();
			this.#reported = true;
			if (control.validationMessage === VALIDATING) this.#attempted = true;
			focusFirstInvalid(control, this.host);
		}
		if (event) this.#trigger(control, event.type);
		if (__DEV__ && control.validity.customError) {
			const message = control.validationMessage;
			if (
				RESERVED_KEYS.has(message) &&
				!(message === VALIDATING && this.#run)
			) {
				warn(`"${message}" is reserved and can't be a custom key.`);
			}
		}
		if (control.validity.valid) this.#reported = false;

		if (event?.type === "focusout" && event.target === control) {
			setState(this.internals, "touched", true);
		}
		setState(
			this.internals,
			"dirty",
			control.value !== this.#initial.get(control),
		);
		setState(this.internals, "filled", control.value !== "");

		if (this.manualAria) return;
		if (this.#reported || control.matches(":user-invalid")) {
			control.ariaInvalid = "true";
		} else {
			control.removeAttribute("aria-invalid");
		}
	};

	connectedCallback(): void {
		this.#abort = new AbortController();
		this.#observer.observe(this.host, { childList: true, subtree: true });
		for (const type of EVENTS) {
			this.host.addEventListener(type, this.#update, {
				capture: type === "invalid",
				signal: this.#abort.signal,
			});
		}
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#observer.disconnect();
		this.#removeSubmitCheck?.();
		this.#linked = undefined;
		if (this.#run) {
			this.#run.abort();
			this.#run = undefined;
			const control = getControl(this.host);
			if (control) this.#write(control, "");
		}
	}

	componentDidLoad(): void {
		this.#update();
	}
}
