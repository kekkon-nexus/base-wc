import { polyfill } from "@microsoft/focusgroup-polyfill";
import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "@/components/tabs/define";

const NATIVE = "focusGroup" in HTMLElement.prototype;

interface Mounted {
	tabs: HTMLElement[];
	panels: HTMLElement[];
}

async function mount(
	attributes = "",
	panels = `
		<div role="tabpanel"><p>Profile text</p></div>
		<div role="tabpanel"><p>Billing text</p></div>
		<div role="tabpanel"><p>Plan text</p></div>
	`,
): Promise<Mounted> {
	document.body.innerHTML = `
		<button id="before">Before</button>
		<base-tabs ${attributes}>
			<div role="tablist" aria-label="Account" focusgroup="tablist">
				<button role="tab">Profile</button>
				<button role="tab">Billing</button>
				<button role="tab">Plan</button>
			</div>
			${panels}
		</base-tabs>
	`;
	await customElements.whenDefined("base-tabs");
	const tablist = document.querySelector<HTMLElement>('[role="tablist"]');
	if (!tablist) throw new Error("not mounted");
	if (!NATIVE) polyfill(tablist);
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
	return {
		tabs: [
			...document.querySelectorAll<HTMLElement>(
				'body > base-tabs > [role="tablist"] > [role="tab"]',
			),
		],
		panels: [
			...document.querySelectorAll<HTMLElement>(
				'body > base-tabs > [role="tabpanel"]',
			),
		],
	};
}

function at<T>(items: T[], index: number): T {
	const item = items[index];
	if (item === undefined) throw new Error("not mounted");
	return item;
}

function selected(tabs: HTMLElement[]): number {
	return tabs.findIndex((tab) => tab.ariaSelected === "true");
}

function open(panels: HTMLElement[]): number[] {
	return panels.flatMap((panel, index) =>
		panel.hasAttribute("hidden") ? [] : [index],
	);
}

it("opens the first panel and links tabs and panels both ways", async () => {
	const { tabs, panels } = await mount();

	expect(selected(tabs)).toBe(0);
	expect(open(panels)).toEqual([0]);
	expect(at(panels, 1).getAttribute("hidden")).toBe("until-found");
	expect(at(tabs, 1).ariaControlsElements).toEqual([at(panels, 1)]);
	expect(at(panels, 1).ariaLabelledByElements).toEqual([at(tabs, 1)]);
});

it("opens the panel marked defaultopen", async () => {
	const { tabs, panels } = await mount(
		"",
		`
		<div role="tabpanel">A</div>
		<div role="tabpanel" defaultopen>B</div>
		<div role="tabpanel">C</div>
	`,
	);

	expect(selected(tabs)).toBe(1);
	expect(open(panels)).toEqual([1]);
});

it("a click selects", async () => {
	const { tabs, panels } = await mount(`activation="manual"`);

	at(tabs, 2).click();

	expect(selected(tabs)).toBe(2);
	expect(open(panels)).toEqual([2]);
});

it("automatic: arrow keys select as they move", async () => {
	const { tabs, panels } = await mount();
	at(tabs, 0).focus();

	await userEvent.keyboard("{ArrowRight}");

	expect(document.activeElement).toBe(at(tabs, 1));
	expect(selected(tabs)).toBe(1);
	expect(open(panels)).toEqual([1]);
});

it("manual: arrow keys move without selecting", async () => {
	const { tabs } = await mount(`activation="manual"`);
	at(tabs, 0).focus();

	await userEvent.keyboard("{ArrowRight}");

	expect(document.activeElement).toBe(at(tabs, 1));
	expect(selected(tabs)).toBe(0);
});

it("Tab enters on the selected tab", async () => {
	const { tabs } = await mount(
		"",
		`
		<div role="tabpanel">A</div>
		<div role="tabpanel" defaultopen>B</div>
		<div role="tabpanel">C</div>
	`,
	);
	document.querySelector<HTMLElement>("#before")?.focus();

	await userEvent.tab();

	expect(document.activeElement).toBe(at(tabs, 1));
	expect(selected(tabs)).toBe(1);
});

it("fires beforetoggle and toggle on both panels, without bubbling", async () => {
	const { tabs, panels } = await mount();
	const events: string[] = [];
	for (const [index, panel] of panels.entries()) {
		for (const type of ["beforetoggle", "toggle"]) {
			panel.addEventListener(type, (event) => {
				const { newState } = event as ToggleEvent;
				events.push(`${type} ${String(index)} ${newState}`);
			});
		}
	}
	let bubbled = false;
	document.addEventListener("toggle", () => {
		bubbled = true;
	});

	at(tabs, 1).click();

	await expect
		.poll(() => events)
		.toEqual([
			"beforetoggle 0 closed",
			"beforetoggle 1 open",
			"toggle 0 closed",
			"toggle 1 open",
		]);
	expect(bubbled).toBe(false);
});

it("a canceled beforetoggle keeps the current tab", async () => {
	const { tabs, panels } = await mount();
	at(panels, 1).addEventListener("beforetoggle", (event) => {
		event.preventDefault();
	});

	at(tabs, 1).click();

	expect(selected(tabs)).toBe(0);
	expect(open(panels)).toEqual([0]);
});

it("beforematch selects the panel find-in-page reached", async () => {
	const { tabs, panels } = await mount();

	at(panels, 2).dispatchEvent(new Event("beforematch", { bubbles: true }));

	expect(selected(tabs)).toBe(2);
});

it("a nested base-tabs keeps its own tabs and panels", async () => {
	const { tabs, panels } = await mount(
		"",
		`
		<div role="tabpanel">
			<base-tabs>
				<div role="tablist" focusgroup="tablist">
					<button role="tab">Inner A</button>
					<button role="tab">Inner B</button>
				</div>
				<div role="tabpanel">Inner A text</div>
				<div role="tabpanel">Inner B text</div>
			</base-tabs>
		</div>
		<div role="tabpanel">B</div>
		<div role="tabpanel">C</div>
	`,
	);
	const inner = [
		...document.querySelectorAll<HTMLElement>(
			"base-tabs base-tabs [role='tab']",
		),
	];

	at(inner, 1).click();

	expect(selected(tabs)).toBe(0);
	expect(open(panels)).toEqual([0]);
	expect(selected(inner)).toBe(1);
});

it("manualaria pairs by aria-controls and links nothing", async () => {
	document.body.innerHTML = `
		<base-tabs manualaria>
			<div role="tablist" focusgroup="tablist">
				<button role="tab" aria-controls="b">B</button>
				<button role="tab" aria-controls="a">A</button>
			</div>
			<div role="tabpanel" id="a">A</div>
			<div role="tabpanel" id="b">B</div>
		</base-tabs>
	`;
	await customElements.whenDefined("base-tabs");
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
	const [first, second] =
		document.querySelectorAll<HTMLElement>('[role="tab"]');
	const panelA = document.querySelector<HTMLElement>("#a");
	if (!first || !second || !panelA) throw new Error("not mounted");

	second.click();

	expect(panelA.hasAttribute("hidden")).toBe(false);
	expect(first.getAttribute("aria-controls")).toBe("b");
	expect(panelA.ariaLabelledByElements).toBeNull();
});
