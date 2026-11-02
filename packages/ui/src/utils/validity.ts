const NATIVE_KEYS = [
	"valueMissing",
	"typeMismatch",
	"patternMismatch",
	"tooLong",
	"tooShort",
	"rangeUnderflow",
	"rangeOverflow",
	"stepMismatch",
	"badInput",
] as const;

/**
 * A custom key travels as the control's custom validity message.
 *
 * @param control a constraint validation target
 * @param control.validity its validity flags
 * @param control.validationMessage its message, carrying the custom key
 * @returns every key the control currently fails
 */
export function failingKeys(control: {
	validity: ValidityState;
	validationMessage: string;
}): Set<string> {
	const keys = new Set<string>(
		NATIVE_KEYS.filter((key) => control.validity[key]),
	);
	if (control.validity.customError) keys.add(control.validationMessage);
	return keys;
}
