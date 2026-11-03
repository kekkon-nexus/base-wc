import { expect, it } from "vite-plus/test";

import "@/components/context-menu/define";

it("opens its menulist at the pointer from contextmenu", async () => {
	document.body.innerHTML = `
		<base-context-menu>
			<div id="area" style="width: 200px; height: 200px">Right click</div>
			<base-menulist id="menu"><base-menuitem>Copy</base-menuitem></base-menulist>
		</base-context-menu>
	`;
	await customElements.whenDefined("base-context-menu");
	await customElements.whenDefined("base-menulist");
	const area = document.querySelector<HTMLElement>("#area");
	const menu = document.querySelector<HTMLElement>("#menu");
	if (!area || !menu) throw new Error("not mounted");

	const event = new MouseEvent("contextmenu", {
		bubbles: true,
		cancelable: true,
		clientX: 40,
		clientY: 60,
	});
	area.dispatchEvent(event);

	expect(event.defaultPrevented).toBe(true);
	await expect.poll(() => menu.matches(":popover-open")).toBe(true);
	expect(menu.style.getPropertyValue("--base-context-menu-x")).toBe("40px");
	expect(menu.style.getPropertyValue("--base-context-menu-y")).toBe("60px");
});
