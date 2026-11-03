import { polyfill } from "@microsoft/focusgroup-polyfill";
import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "@/components/menubar/define";

const NATIVE = "focusGroup" in HTMLElement.prototype;

async function mount(): Promise<void> {
	document.body.innerHTML = `
		<base-menubar aria-label="App">
			<base-submenu>
				<base-menuitem id="file">File</base-menuitem>
				<base-menulist id="file-menu">
					<base-menuitem id="new">New</base-menuitem>
				</base-menulist>
			</base-submenu>
			<base-submenu>
				<base-menuitem id="view">View</base-menuitem>
				<base-menulist id="view-menu">
					<base-menuitem id="zoom">Zoom</base-menuitem>
				</base-menulist>
			</base-submenu>
		</base-menubar>
	`;
	await customElements.whenDefined("base-menubar");
	await customElements.whenDefined("base-menulist");
	if (!NATIVE) {
		polyfill(document.querySelector("base-menubar") ?? document.body);
		for (const list of document.querySelectorAll<HTMLElement>(
			"base-menulist",
		)) {
			list.addEventListener("toggle", (event) => {
				if (event.newState === "open") polyfill(list);
			});
		}
	}
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
}

function byId(id: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`#${id}`);
	if (!element) throw new Error("not mounted");
	return element;
}

function isOpen(id: string): boolean {
	return byId(id).matches(":popover-open");
}

it("is a menubar whose items open their menus on click and ArrowDown", async () => {
	await mount();

	byId("file").click();
	await expect.poll(() => isOpen("file-menu")).toBe(true);
	await expect.poll(() => document.activeElement).toBe(byId("new"));

	await userEvent.keyboard("{Escape}");
	await expect.poll(() => isOpen("file-menu")).toBe(false);
	expect(document.activeElement).toBe(byId("file"));

	await userEvent.keyboard("{ArrowDown}");
	await expect.poll(() => isOpen("file-menu")).toBe(true);
});

it("the inline arrows inside a menu move to the next menu and open it", async () => {
	await mount();
	byId("file").click();
	await expect.poll(() => document.activeElement).toBe(byId("new"));

	await userEvent.keyboard("{ArrowRight}");

	await expect.poll(() => isOpen("view-menu")).toBe(true);
	expect(isOpen("file-menu")).toBe(false);
	await expect.poll(() => document.activeElement).toBe(byId("zoom"));

	await userEvent.keyboard("{ArrowLeft}");
	await expect.poll(() => isOpen("file-menu")).toBe(true);
});

it("once a menu is open, pointing at another item switches to it", async () => {
	await mount();
	byId("file").click();
	await expect.poll(() => isOpen("file-menu")).toBe(true);

	await userEvent.hover(byId("view"));

	await expect.poll(() => isOpen("view-menu")).toBe(true);
	expect(isOpen("file-menu")).toBe(false);
});

it("pointing at an item while no menu is open opens nothing", async () => {
	await mount();

	await userEvent.hover(byId("view"));
	await new Promise((resolve) => {
		setTimeout(resolve, 150);
	});

	expect(isOpen("view-menu")).toBe(false);
});
