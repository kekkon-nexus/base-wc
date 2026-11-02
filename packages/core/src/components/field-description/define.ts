import { FieldDescription } from "@/components/field-description";
import { define } from "@/utils/define";

define(FieldDescription);

export type { FieldDescription } from "@/components/field-description";

declare global {
	interface HTMLElementTagNameMap {
		"base-field-description": FieldDescription;
	}
}
