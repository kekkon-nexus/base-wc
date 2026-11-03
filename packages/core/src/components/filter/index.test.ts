import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "@/components/filter/define";

const OPTIONS = `
	<option value="bug">Bug</option>
	<option value="docs">Documentation</option>
	<option value="debt">Tech debt</option>
	<option value="secret" hidden>Secret</option>
`;

async function mountSelect(search = ""): Promise<{
	input: HTMLInputElement;
	select: HTMLSelectElement;
}> {
	document.body.innerHTML = `
		<base-filter>
			<input filter="labels" ${search} aria-label="Filter labels">
			<select id="labels" size="4">${OPTIONS}</select>
		</base-filter>
	`;
	await customElements.whenDefined("base-filter");
	const input = document.querySelector("input");
	const select = document.querySelector("select");
	if (!input || !select) throw new Error("not mounted");
	return { input, select };
}

function shown(select: HTMLElement): string[] {
	return [...select.querySelectorAll("option")]
		.filter((option) => !option.hidden)
		.map((option) => option.value);
}

it("filters with includes by default, case-insensitive", async () => {
	const { input, select } = await mountSelect();

	await userEvent.type(input, "DE");

	await expect.poll(() => shown(select)).toEqual(["debt"]);
});

it("startswith narrows to prefixes", async () => {
	const { input, select } = await mountSelect(`search="startswith"`);

	await userEvent.type(input, "d");

	await expect.poll(() => shown(select)).toEqual(["docs"]);
});

it("clearing the filter leaves options the consumer hid alone", async () => {
	const { input, select } = await mountSelect();
	await userEvent.type(input, "bug");
	await expect.poll(() => shown(select)).toEqual(["bug"]);

	// WebDriver's clear fires no `input`, so the text is deleted as a person would.
	input.select();
	await userEvent.keyboard("{Backspace}");

	await expect.poll(() => shown(select)).toEqual(["bug", "docs", "debt"]);
});

it("a canceled beforefilter leaves filtering to the consumer", async () => {
	const { input, select } = await mountSelect();
	const queries: string[] = [];
	input.addEventListener("beforefilter", (event) => {
		event.preventDefault();
		queries.push((event as Event & { query: string }).query);
	});

	await userEvent.type(input, "b");

	await expect.poll(() => queries).toEqual(["b"]);
	expect(shown(select)).toEqual(["bug", "docs", "debt"]);
});

it("arrow keys move the active option with focus kept in the input", async () => {
	const { input, select } = await mountSelect();
	input.focus();

	await userEvent.keyboard("{ArrowDown}{ArrowDown}");

	const active = select.querySelector("[activeoption]");
	expect(active?.getAttribute("value")).toBe("docs");
	expect(input.ariaActiveDescendantElement).toBe(active);
	expect(document.activeElement).toBe(input);
	expect(select.querySelectorAll("[activeoption]")).toHaveLength(1);
});

it("Enter selects the active option in the select", async () => {
	const { input, select } = await mountSelect();
	const change = vi.fn();
	select.addEventListener("change", change);
	input.focus();

	await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

	expect(select.value).toBe("docs");
	expect(change).toHaveBeenCalledOnce();
});

it("a click selects and keeps focus in the input", async () => {
	const { input, select } = await mountSelect();
	input.focus();

	const debt = select.querySelector<HTMLElement>('option[value="debt"]');
	if (!debt) throw new Error("not mounted");
	await userEvent.click(debt);

	expect(select.value).toBe("debt");
	expect(document.activeElement).toBe(input);
});

it("autocomplete: a listbox fills the input and its popover opens and closes", async () => {
	document.body.innerHTML = `
		<base-filter>
			<input filter="fruits" aria-label="Fruit">
			<div popover="manual" id="pop">
				<div role="listbox" id="fruits">
					<div role="option">Apple</div>
					<div role="option">Apricot</div>
					<div role="option">Banana</div>
				</div>
			</div>
		</base-filter>
	`;
	await customElements.whenDefined("base-filter");
	const input = document.querySelector("input");
	const pop = document.querySelector<HTMLElement>("#pop");
	if (!input || !pop) throw new Error("not mounted");
	expect(input.ariaExpanded).toBe("false");

	await userEvent.type(input, "ap");
	await expect.poll(() => pop.matches(":popover-open")).toBe(true);
	expect(input.ariaExpanded).toBe("true");

	await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

	expect(input.value).toBe("Apricot");
	expect(pop.matches(":popover-open")).toBe(false);
});
