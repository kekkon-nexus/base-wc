import { expect, it, vi } from "vite-plus/test";
import { commands, server, userEvent } from "vite-plus/test/browser";

import "@/components/field/define";
import "@/components/form-errors/define";

interface Mounted {
	form: HTMLFormElement;
	formErrors: HTMLBaseFormErrorsElement;
	first: HTMLInputElement;
	second: HTMLInputElement;
}

async function mount(extra = ""): Promise<Mounted> {
	document.body.innerHTML = `
		<form>
			<base-field>
				<label>First <input name="first"></label>
				<base-field-error id="first-error" match="registered">Registered</base-field-error>
			</base-field>
			<base-field>
				<label>Second <input name="second"></label>
				<base-field-error id="second-error" match="banned">Banned</base-field-error>
			</base-field>
			${extra}
			<base-form-errors>
				<base-form-error id="unavailable" match="unavailable">Later</base-form-error>
				<base-form-error id="catch-all">Something went wrong</base-form-error>
			</base-form-errors>
			<button>Submit</button>
		</form>
	`;
	await customElements.whenDefined("base-field");
	await customElements.whenDefined("base-form-errors");
	await customElements.whenDefined("base-form-error");
	const form = document.querySelector("form");
	const formErrors = document.querySelector("base-form-errors");
	const first = document.querySelector<HTMLInputElement>(`[name="first"]`);
	const second = document.querySelector<HTMLInputElement>(`[name="second"]`);
	if (!form || !formErrors || !first || !second) {
		throw new Error("not mounted");
	}
	await settle();
	return { form, formErrors, first, second };
}

function hidden(id: string): unknown {
	return document.querySelector<HTMLElement>(`#${id}`)?.hidden;
}

async function settle(): Promise<void> {
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
}

it("focuses the first invalid control in document order, whatever the key order", async () => {
	const { formErrors, first } = await mount();

	formErrors.errors = { fields: { second: "banned", first: "registered" } };

	expect(document.activeElement).toBe(first);
	expect(hidden("first-error")).toBe(false);
	expect(hidden("second-error")).toBe(false);
});

it("editing clears the key and the consumer's rule applies again", async () => {
	const { formErrors, first } = await mount();
	first.addEventListener("input", () => {
		first.setCustomValidity(first.value === "ab" ? "registered" : "");
	});
	formErrors.errors = { fields: { first: "registered" } };

	await userEvent.keyboard("a");
	expect(first.validationMessage).toBe("");
	expect(hidden("first-error")).toBe(true);

	await userEvent.keyboard("b");
	expect(first.validationMessage).toBe("registered");
});

it("field's validate runs again after a server key clears", async () => {
	const { formErrors, first } = await mount();
	const field = first.closest("base-field");
	if (!field) throw new Error("not mounted");
	field.validate = () => "registered";
	formErrors.errors = { fields: { first: "banned" } };

	await userEvent.keyboard("a");

	await expect.poll(() => first.validationMessage).toBe("registered");
});

it("controls named after form members do not break it", async () => {
	const names = [
		"elements",
		"addEventListener",
		"checkValidity",
		"requestSubmit",
		"contains",
	];
	const { formErrors } = await mount(
		names.map((name) => `<input name="${name}">`).join(""),
	);

	formErrors.errors = { fields: { elements: "registered" } };

	const control = document.querySelector<HTMLInputElement>(`[name="elements"]`);
	expect(control?.validationMessage).toBe("registered");
});

it("a radio group's key lands on its first radio", async () => {
	const { formErrors } = await mount(`
		<base-field>
			<input type="radio" name="plan" value="a">
			<input type="radio" name="plan" value="b">
			<base-field-error id="plan-error" match="closed">Closed</base-field-error>
		</base-field>
	`);

	formErrors.errors = { fields: { plan: "closed" } };

	const radio = document.querySelector<HTMLInputElement>(`[value="a"]`);
	expect(radio?.validationMessage).toBe("closed");
	expect(hidden("plan-error")).toBe(false);
});

it("form-level only shows the message and leaves focus", async () => {
	const { formErrors, second } = await mount();
	second.focus();

	formErrors.errors = { form: "unavailable" };

	await expect.poll(() => hidden("unavailable")).toBe(false);
	expect(hidden("catch-all")).toBe(true);
	expect(document.activeElement).toBe(second);
});

it("an unknown form key falls to the catch-all", async () => {
	const { formErrors } = await mount();

	formErrors.errors = { form: "teapot" };

	await expect.poll(() => hidden("catch-all")).toBe(false);
	expect(hidden("unavailable")).toBe(true);
});

it("errors.form stays through edits until the next assignment", async () => {
	const { formErrors, first } = await mount();
	formErrors.errors = { form: "unavailable" };
	await expect.poll(() => hidden("unavailable")).toBe(false);

	await userEvent.type(first, "a");
	expect(hidden("unavailable")).toBe(false);

	formErrors.errors = {};
	await expect.poll(() => hidden("unavailable")).toBe(true);
});

it("an assignment clears the controls the previous one set", async () => {
	const { formErrors, first, second } = await mount();
	formErrors.errors = { fields: { first: "registered" } };

	formErrors.errors = { fields: { second: "banned" } };

	expect(first.validationMessage).toBe("");
	expect(hidden("first-error")).toBe(true);
	expect(second.validationMessage).toBe("banned");
});

it("reset clears every error and unblocks the form", async () => {
	const { form, formErrors, first } = await mount();
	formErrors.errors = { fields: { first: "registered" }, form: "unavailable" };

	form.reset();

	await expect.poll(() => first.validity.valid).toBe(true);
	await expect.poll(() => hidden("first-error")).toBe(true);
	expect(hidden("unavailable")).toBe(true);
});

it("a canceled reset keeps the errors", async () => {
	const { form, formErrors, first } = await mount();
	formErrors.errors = { fields: { first: "registered" } };
	form.addEventListener("reset", (event) => {
		event.preventDefault();
	});

	form.reset();
	await settle();

	expect(first.validationMessage).toBe("registered");
});

it("reset clears field's own key and shown error", async () => {
	const { form, first } = await mount();
	const field = first.closest("base-field");
	if (!field) throw new Error("not mounted");
	field.validate = () => "registered";

	await userEvent.type(first, "a");
	await expect.poll(() => first.validationMessage).toBe("registered");
	first.checkValidity();

	form.reset();

	await expect.poll(() => first.validity.valid).toBe(true);
	expect(hidden("first-error")).toBe(true);
	expect(first.hasAttribute("aria-invalid")).toBe(false);
});

it("reset hides an error from a control that is invalid again", async () => {
	document.body.innerHTML = `
		<form>
			<base-field>
				<input required>
				<base-field-error id="missing" match="valueMissing">Missing</base-field-error>
			</base-field>
		</form>
	`;
	await customElements.whenDefined("base-field");
	const form = document.querySelector("form");
	if (!form) throw new Error("not mounted");
	form.checkValidity();
	await expect.poll(() => hidden("missing")).toBe(false);

	form.reset();

	await expect.poll(() => hidden("missing")).toBe(true);
});

it("outside a form it warns, and picks the form up once moved in", async () => {
	const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
	document.body.innerHTML = `
		<base-form-errors></base-form-errors>
		<form><input name="first"></form>
	`;
	const formErrors = document.querySelector("base-form-errors");
	const form = document.querySelector("form");
	const input = document.querySelector("input");
	if (!formErrors || !form || !input) throw new Error("not mounted");
	await customElements.whenDefined("base-form-errors");
	await settle();
	expect(warnSpy.mock.calls.flat().join(" ")).toContain("not inside a form");

	formErrors.errors = { fields: { first: "registered" } };
	expect(input.validationMessage).toBe("");

	form.append(formErrors);

	await expect.poll(() => input.validationMessage).toBe("registered");
	warnSpy.mockRestore();
});

it("warns about a name with no control and a form key with no error", async () => {
	const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
	document.body.innerHTML = `
		<form>
			<base-form-errors>
				<base-form-error match="unavailable"></base-form-error>
			</base-form-errors>
		</form>
	`;
	await customElements.whenDefined("base-form-errors");
	const formErrors = document.querySelector("base-form-errors");
	if (!formErrors) throw new Error("not mounted");
	await settle();

	formErrors.errors = { fields: { ghost: "gone" }, form: "teapot" };

	const messages = warnSpy.mock.calls.flat().join(" ");
	expect(messages).toContain(`"ghost"`);
	expect(messages).toContain(`"teapot"`);
	warnSpy.mockRestore();
});

it.runIf(server.browser === "chrome")(
	"the errors element is a polite live region with no attribute",
	async () => {
		const { formErrors } = await mount();

		expect(formErrors.hasAttribute("aria-live")).toBe(false);
		expect(await commands.computedProperty("base-form-errors", "live")).toBe(
			"polite",
		);
	},
);
