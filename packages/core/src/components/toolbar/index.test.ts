import { polyfill } from "@microsoft/focusgroup-polyfill";
import { expect, it, vi } from "vite-plus/test";
import { commands, server, userEvent } from "vite-plus/test/browser";

import "@/components/toolbar/define";

const NATIVE = "focusGroup" in HTMLElement.prototype;

async function mount(
	items = `
		<button id="bold">Bold</button>
		<button id="italic" aria-disabled="true">Italic</button>
		<fieldset><button id="undo">Undo</button></fieldset>
	`,
	usePolyfill = true,
): Promise<HTMLBaseToolbarElement> {
	document.body.innerHTML = `
		<button id="before">Before</button>
		<base-toolbar aria-label="Format">${items}</base-toolbar>
		<button id="after">After</button>
	`;
	await customElements.whenDefined("base-toolbar");
	const toolbar = document.querySelector("base-toolbar");
	if (!toolbar) throw new Error("not mounted");
	// The consumer's job where focusgroup is missing, before the dev check a task after connect.
	if (!NATIVE && usePolyfill) polyfill(toolbar);
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
	return toolbar;
}

function byId(id: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`#${id}`);
	if (!element) throw new Error("not mounted");
	return element;
}

it("is one tab stop", async () => {
	await mount();
	byId("before").focus();

	await userEvent.tab();
	expect(document.activeElement).toBe(byId("bold"));

	await userEvent.tab();
	expect(document.activeElement).toBe(byId("after"));
});

it("arrow keys reach an aria-disabled item and one inside a fieldset", async () => {
	await mount();
	byId("bold").focus();

	await userEvent.keyboard("{ArrowRight}");
	expect(document.activeElement).toBe(byId("italic"));

	await userEvent.keyboard("{ArrowRight}");
	expect(document.activeElement).toBe(byId("undo"));

	await userEvent.keyboard("{Home}");
	expect(document.activeElement).toBe(byId("bold"));
});

it("an aria-disabled item does not act on click, Enter or Space", async () => {
	await mount();
	const clicked = vi.fn();
	byId("italic").addEventListener("click", clicked);

	byId("italic").click();
	byId("italic").focus();
	await userEvent.keyboard("{Enter}");
	await userEvent.keyboard(" ");

	expect(clicked).not.toHaveBeenCalled();
});

it("other items still act", async () => {
	await mount();
	const clicked = vi.fn();
	byId("bold").addEventListener("click", clicked);

	byId("bold").click();

	expect(clicked).toHaveBeenCalledOnce();
});

// The polyfill stops arrow keys at a disabled fieldset instead of skipping it.
it.runIf(NATIVE)("a disabled fieldset takes its items out", async () => {
	await mount(`
		<button id="bold">Bold</button>
		<fieldset disabled><button id="undo">Undo</button></fieldset>
		<button id="redo">Redo</button>
	`);
	byId("bold").focus();

	await userEvent.keyboard("{ArrowRight}");

	expect(document.activeElement).toBe(byId("redo"));
});

it("keeps a focusgroup the consumer wrote", async () => {
	const toolbar = await mount(`<button>A</button>`);
	expect(toolbar.getAttribute("focusgroup")).toBe("toolbar");

	document.body.innerHTML = `<base-toolbar focusgroup="toolbar nowrap"></base-toolbar>`;
	const own = document.querySelector("base-toolbar");
	expect(own?.getAttribute("focusgroup")).toBe("toolbar nowrap");
});

it.runIf(server.browser === "chrome")("exposes a toolbar role", async () => {
	await mount();

	expect(await commands.computedProperty("base-toolbar", "role")).toBe(
		"toolbar",
	);
});
