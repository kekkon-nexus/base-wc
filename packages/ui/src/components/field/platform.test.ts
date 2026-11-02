import { expect, it } from "vite-plus/test";
import { commands, server, userEvent } from "vite-plus/test/browser";

function mount(html: string): HTMLInputElement {
	document.body.innerHTML = html;
	const element = document.querySelector("input");
	if (!element) throw new Error("not mounted");
	return element;
}

it("validationMessage returns exactly the custom string", () => {
	const input = mount(`<input>`);

	input.setCustomValidity("taken");

	expect(input.validationMessage).toBe("taken");
});

it("validationMessage returns the custom string while a native check fails", () => {
	const input = mount(`<input required>`);

	input.setCustomValidity("taken");

	expect(input.validity.valueMissing).toBe(true);
	expect(input.validity.customError).toBe(true);
	expect(input.validationMessage).toBe("taken");
});

it("setting ariaDescribedByElements leaves an empty attribute", () => {
	const input = mount(`<input><p id="first">First</p>`);
	const first = document.querySelector("#first");
	if (!first) throw new Error("not mounted");

	input.ariaDescribedByElements = [first];

	expect(input.getAttribute("aria-describedby")).toBe("");
	expect(input.ariaDescribedByElements).toEqual([first]);
});

it("writing aria-describedby clears the elements set from script", () => {
	const input = mount(
		`<input><p id="first">First</p><p id="second">Second</p>`,
	);
	const first = document.querySelector("#first");
	const second = document.querySelector("#second");
	if (!first || !second) throw new Error("not mounted");
	input.ariaDescribedByElements = [first];

	input.setAttribute("aria-describedby", "second");

	expect(input.ariaDescribedByElements).toEqual([second]);
});

it.runIf(server.browser === "chrome")(
	"the native invalid state stays unexposed after user-invalid",
	async () => {
		const input = mount(`<input required>`);
		expect(await commands.computedProperty("input", "invalid")).toBe("false");

		await userEvent.type(input, "a");
		await userEvent.clear(input);
		await userEvent.tab();

		expect(input.matches(":user-invalid")).toBe(true);
		expect(await commands.computedProperty("input", "invalid")).toBe("false");
	},
);

it.runIf(server.browser === "chrome")(
	"computedProperty reads aria-invalid",
	async () => {
		mount(`<input aria-invalid="true">`);

		expect(await commands.computedProperty("input", "invalid")).toBe("true");
	},
);

it.runIf(server.browser === "chrome")(
	"the description skips hidden children linked through ariaDescribedByElements",
	async () => {
		const input = mount(
			`<input><div id="errors"><p hidden>Hidden</p><p>Shown</p></div>`,
		);
		const errors = document.querySelector("#errors");
		if (!errors) throw new Error("not mounted");

		input.ariaDescribedByElements = [errors];

		expect(await commands.computedDescription("input")).toBe("Shown");
	},
);
