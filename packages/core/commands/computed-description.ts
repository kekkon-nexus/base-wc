import type { BrowserCommand } from "vite-plus/test/node";

interface DomNode {
	nodeId: number;
	children?: DomNode[];
	contentDocument?: DomNode;
	shadowRoots?: DomNode[];
}

function* documents(node: DomNode): Generator<DomNode> {
	if (node.contentDocument) {
		yield node.contentDocument;
		yield* documents(node.contentDocument);
	}
	for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) {
		yield* documents(child);
	}
}

interface AxNode {
	description?: { value: string };
	role?: { value: string };
	properties?: { name: string; value: { value: unknown } }[];
}

/**
 * WebDriver reads only role and label from the accessibility tree, so this asks Chrome DevTools Protocol, Chrome only.
 * Tests run inside iframes, so the selector is tried in every frame's document.
 *
 * @param context the command context, holding the WebdriverIO browser
 * @param selector a CSS selector for the element
 * @returns the element's accessibility node
 */
async function axNode(
	context: Parameters<BrowserCommand>[0],
	selector: string,
): Promise<AxNode | undefined> {
	const send = <T>(cmd: string, params: object = {}): Promise<T> =>
		context.browser.sendCommandAndGetResult(cmd, params) as Promise<T>;

	const { root } = await send<{ root: DomNode }>("DOM.getDocument", {
		depth: -1,
		pierce: true,
	});
	for (const document of [root, ...documents(root)]) {
		const { nodeId } = await send<{ nodeId: number }>("DOM.querySelector", {
			nodeId: document.nodeId,
			selector,
		});
		if (!nodeId) continue;
		const { nodes } = await send<{ nodes: AxNode[] }>(
			"Accessibility.getPartialAXTree",
			{ nodeId, fetchRelatives: false },
		);
		return nodes[0];
	}
	throw new Error(`no element matches ${selector}`);
}

/**
 * @param context the command context, holding the WebdriverIO browser
 * @param selector a CSS selector for the described element
 * @returns the element's computed accessible description
 */
export const computedDescription: BrowserCommand<[selector: string]> = async (
	context,
	selector,
) => {
	const node = await axNode(context, selector);
	return node?.description?.value ?? "";
};

/**
 * @param context the command context, holding the WebdriverIO browser
 * @param selector a CSS selector for the element
 * @param name the accessibility property to read
 * @returns the value of that accessibility property, such as `"true"` for `invalid`
 */
export const computedProperty: BrowserCommand<
	[selector: string, name: string]
> = async (context, selector, name) => {
	const node = await axNode(context, selector);
	if (name === "role") return String(node?.role?.value);
	return String(
		node?.properties?.find((property) => property.name === name)?.value.value,
	);
};
