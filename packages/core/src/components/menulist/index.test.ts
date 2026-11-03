import { polyfill } from "@microsoft/focusgroup-polyfill";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "@/components/menulist/define";

const NATIVE = "focusGroup" in HTMLElement.prototype;

type Checkable = HTMLElement & { checked: boolean };

async function mount(): Promise<{
	button: HTMLButtonElement;
	menu: HTMLElement;
	zoom: HTMLElement;
}> {
	document.body.innerHTML = `
		<button id="open" command="--toggle-menu" commandfor="edit">Edit</button>
		<button id="after">After</button>
		<base-menulist id="edit">
			<base-menuitem id="copy">Copy</base-menuitem>
			<base-menuitem id="paste" disabled>Paste</base-menuitem>
			<hr>
			<base-menuitemcheckbox id="ruler" defaultchecked>Show ruler</base-menuitemcheckbox>
			<base-submenu>
				<base-menuitem id="zoom-trigger">Zoom</base-menuitem>
				<base-menulist id="zoom">
					<base-menuitemradio id="half">50%</base-menuitemradio>
					<base-menuitemradio id="full" defaultchecked>100%</base-menuitemradio>
				</base-menulist>
			</base-submenu>
		</base-menulist>
	`;
	await customElements.whenDefined("base-menulist");
	const button = document.querySelector<HTMLButtonElement>("#open");
	const menu = document.querySelector<HTMLElement>("#edit");
	const zoom = document.querySelector<HTMLElement>("#zoom");
	if (!button || !menu || !zoom) throw new Error("not mounted");
	if (!NATIVE) {
		// The polyfill does not see items in a closed popover, so it runs once each opens.
		for (const list of [menu, zoom]) {
			list.addEventListener("toggle", (event) => {
				if (event.newState === "open") polyfill(list);
			});
		}
	}
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
	return { button, menu, zoom };
}

function byId(id: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`#${id}`);
	if (!element) throw new Error("not mounted");
	return element;
}

async function openMenu(
	button: HTMLButtonElement,
	menu: HTMLElement,
): Promise<void> {
	button.click();
	await expect.poll(() => menu.matches(":popover-open")).toBe(true);
	await expect.poll(() => document.activeElement).toBe(byId("copy"));
}

it("--toggle-menu opens the menulist and focuses its first item", async () => {
	const { button, menu } = await mount();

	await openMenu(button, menu);

	button.click();
	await expect.poll(() => menu.matches(":popover-open")).toBe(false);
});

// The polyfill skips an item with a `disabled` attribute, which the proposal keeps focusable.
it.runIf(NATIVE)(
	"arrow keys move between items, a disabled one included",
	async () => {
		const { button, menu } = await mount();
		await openMenu(button, menu);

		await userEvent.keyboard("{ArrowDown}");

		expect(document.activeElement).toBe(byId("paste"));
	},
);

it("activating an item fires click and closes the menu", async () => {
	const { button, menu } = await mount();
	const clicked = vi.fn();
	byId("copy").addEventListener("click", clicked);
	await openMenu(button, menu);

	await userEvent.keyboard("{Enter}");

	expect(clicked).toHaveBeenCalledOnce();
	await expect.poll(() => menu.matches(":popover-open")).toBe(false);
});

it("a disabled item does not act and keeps the menu open", async () => {
	const { button, menu } = await mount();
	const clicked = vi.fn();
	menu.addEventListener("click", clicked);
	await openMenu(button, menu);

	byId("paste").click();

	expect(menu.matches(":popover-open")).toBe(true);
	expect(byId("paste").getAttribute("aria-disabled") ?? "true").toBe("true");
});

it("a checkbox item toggles and fires checked", async () => {
	const { button, menu } = await mount();
	const ruler = byId("ruler") as Checkable;
	const checked = vi.fn();
	ruler.addEventListener("checked", checked);
	expect(ruler.checked).toBe(true);
	expect(ruler.matches(":state(checked)")).toBe(true);
	await openMenu(button, menu);

	ruler.click();

	expect(ruler.checked).toBe(false);
	expect(ruler.matches(":state(checked)")).toBe(false);
	expect(checked).toHaveBeenCalledOnce();
});

it("a canceled click leaves a checkbox item as it was", async () => {
	const { button, menu } = await mount();
	const ruler = byId("ruler") as Checkable;
	ruler.addEventListener("click", (event) => {
		event.preventDefault();
	});
	await openMenu(button, menu);

	ruler.click();

	expect(ruler.checked).toBe(true);
});

it("radio items are exclusive", async () => {
	await mount();
	const half = byId("half") as Checkable;
	const full = byId("full") as Checkable;

	half.click();

	expect([half.checked, full.checked]).toEqual([true, false]);
});

it("the inline-end arrow opens a submenu and the inline-start arrow closes it", async () => {
	const { button, menu, zoom } = await mount();
	await openMenu(button, menu);
	byId("zoom-trigger").focus();

	await userEvent.keyboard("{ArrowRight}");
	await expect.poll(() => zoom.matches(":popover-open")).toBe(true);
	await expect.poll(() => document.activeElement).toBe(byId("half"));
	expect(byId("zoom-trigger").ariaExpanded).toBe("true");

	await userEvent.keyboard("{ArrowLeft}");
	await expect.poll(() => zoom.matches(":popover-open")).toBe(false);
	expect(document.activeElement).toBe(byId("zoom-trigger"));
	expect(menu.matches(":popover-open")).toBe(true);
});

it("Escape closes only the submenu", async () => {
	const { button, menu, zoom } = await mount();
	await openMenu(button, menu);
	byId("zoom-trigger").click();
	await expect.poll(() => zoom.matches(":popover-open")).toBe(true);

	await userEvent.keyboard("{Escape}");

	await expect.poll(() => zoom.matches(":popover-open")).toBe(false);
	expect(menu.matches(":popover-open")).toBe(true);
});

it("choosing in a submenu closes every menu", async () => {
	const { button, menu, zoom } = await mount();
	await openMenu(button, menu);
	byId("zoom-trigger").click();
	await expect.poll(() => zoom.matches(":popover-open")).toBe(true);

	byId("half").click();

	await expect.poll(() => menu.matches(":popover-open")).toBe(false);
	expect(zoom.matches(":popover-open")).toBe(false);
});

it("hovering a submenu trigger opens it, hovering another item closes it", async () => {
	const { button, menu, zoom } = await mount();
	await openMenu(button, menu);

	await userEvent.hover(byId("zoom-trigger"));
	await expect.poll(() => zoom.matches(":popover-open")).toBe(true);

	await userEvent.hover(byId("copy"));
	await expect.poll(() => zoom.matches(":popover-open")).toBe(false);
});

it("Tab out of the menu closes it", async () => {
	const { button, menu } = await mount();
	await openMenu(button, menu);

	byId("after").focus();

	await expect.poll(() => menu.matches(":popover-open")).toBe(false);
});
