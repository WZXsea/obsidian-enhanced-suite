import {
	parseCmdkQuery,
	type ParsedCmdkQuery,
} from "./queryParser";

export const FILTER_AUTOCOMPLETE_KEYS = [
	"type",
	"in",
	"path",
	"ext",
	"tag",
	"file",
	"head",
	"heading",
	"content",
] as const;

export type FilterAutocompleteKey =
	(typeof FILTER_AUTOCOMPLETE_KEYS)[number];

export type ActivatedFilterKey =
	| "type"
	| "in"
	| "path"
	| "ext"
	| "tag"
	| "file"
	| "heading"
	| "content";

export type FilterAutocompleteStatus =
	| "none"
	| "key-prefix"
	| "value-incomplete"
	| "valid"
	| "invalid";

export type FilterAutocompleteReason =
	| "invalid-value"
	| "missing-value"
	| "unexpected-quote"
	| "unknown-filter"
	| "unterminated-quote";

export interface TextRange {
	from: number;
	to: number;
}

export interface FilterAutocompleteSuggestion {
	id: string;
	insertText: string;
	key: FilterAutocompleteKey;
	kind: "key" | "value";
	label: string;
	value?: string;
}

export interface ActivatedFilterToken {
	key: ActivatedFilterKey;
	serialized: string;
	sourceKey: FilterAutocompleteKey;
	values: string[];
}

export interface FilterAutocompleteState {
	canActivate: boolean;
	key?: FilterAutocompleteKey;
	keyPrefix: string;
	range: TextRange;
	rawToken: string;
	reason?: FilterAutocompleteReason;
	status: FilterAutocompleteStatus;
	suggestions: FilterAutocompleteSuggestion[];
	token?: ActivatedFilterToken;
	valuePrefix?: string;
}

export type FilterAutocompleteTrigger = "Enter" | "Tab";

export interface FilterAutocompleteAcceptance {
	cursorOffset: number;
	input: string;
	kind: "activated" | "continued";
	parsed?: ParsedCmdkQuery;
	range: TextRange;
	remainingQuery?: string;
	state: FilterAutocompleteState;
	token?: ActivatedFilterToken;
	trigger: FilterAutocompleteTrigger;
}

export interface ExtractedFilterTokens {
	input: string;
	tokens: ActivatedFilterToken[];
}

interface InputToken {
	from: number;
	raw: string;
	to: number;
}

interface ValueAnalysis {
	normalizedValues: string[];
	reason?: FilterAutocompleteReason;
	status: "invalid" | "value-incomplete" | "valid";
	suggestions: FilterAutocompleteSuggestion[];
	valuePrefix: string;
}

const FILTER_KEY_SET = new Set<string>(FILTER_AUTOCOMPLETE_KEYS);

const TYPE_VALUE_ALIASES: Record<string, string> = {
	body: "content",
	content: "content",
	file: "file",
	files: "file",
	heading: "heading",
	headings: "heading",
};

const IN_VALUE_ALIASES: Record<string, string> = {
	body: "content",
	content: "content",
	file: "name",
	heading: "heading",
	headings: "heading",
	name: "name",
	path: "path",
	title: "name",
};

const VALUE_OPTIONS: Partial<
	Record<FilterAutocompleteKey, readonly string[]>
> = {
	in: ["name", "path", "heading", "content"],
	type: ["file", "heading", "content"],
};

const toActivatedKey = (key: FilterAutocompleteKey): ActivatedFilterKey =>
	key === "head" ? "heading" : key;

const tokenizeInput = (input: string): InputToken[] => {
	const tokens: InputToken[] = [];
	let start = -1;
	let quote = "";

	for (let index = 0; index < input.length; index++) {
		const char = input[index];
		if (start < 0) {
			if (/\s/u.test(char)) continue;
			start = index;
		}

		if (quote) {
			if (char === quote) quote = "";
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (/\s/u.test(char)) {
			tokens.push({
				from: start,
				raw: input.slice(start, index),
				to: index,
			});
			start = -1;
		}
	}

	if (start >= 0) {
		tokens.push({
			from: start,
			raw: input.slice(start),
			to: input.length,
		});
	}
	return tokens;
};

const getTokenAtCursor = (input: string, cursorOffset: number): InputToken => {
	const cursor = Math.max(0, Math.min(cursorOffset, input.length));
	const tokens = tokenizeInput(input);
	const atCursor = tokens.find(
		(token) => token.from <= cursor && cursor <= token.to
	);
	if (atCursor) return atCursor;

	return {
		from: cursor,
		raw: "",
		to: cursor,
	};
};

const keySuggestions = (prefix: string) => {
	const normalizedPrefix = prefix.trim().toLowerCase();
	return FILTER_AUTOCOMPLETE_KEYS.filter((key) =>
		key.startsWith(normalizedPrefix)
	)
		.sort((a, b) => {
			if (a === normalizedPrefix) return -1;
			if (b === normalizedPrefix) return 1;
			return (
				FILTER_AUTOCOMPLETE_KEYS.indexOf(a) -
				FILTER_AUTOCOMPLETE_KEYS.indexOf(b)
			);
		})
		.map(
			(key): FilterAutocompleteSuggestion => ({
				id: `key:${key}`,
				insertText: `${key}:`,
				key,
				kind: "key",
				label: `${key}:`,
			})
		);
};

const valueSuggestions = (
	key: FilterAutocompleteKey,
	prefix: string
) => {
	const options = VALUE_OPTIONS[key] ?? [];
	const normalizedPrefix = prefix.trim().toLowerCase();
	return options
		.filter((value) => value.startsWith(normalizedPrefix))
		.map(
			(value): FilterAutocompleteSuggestion => ({
				id: `value:${key}:${value}`,
				insertText: value,
				key,
				kind: "value",
				label: value,
				value,
			})
		);
};

const hasBalancedOuterQuote = (value: string) => {
	const first = value[0];
	if (first !== '"' && first !== "'") return null;
	const closingIndex = value.indexOf(first, 1);
	if (closingIndex < 0) {
		return {
			reason: "unterminated-quote" as const,
			valid: false,
		};
	}
	if (closingIndex !== value.length - 1) {
		return {
			reason: "unexpected-quote" as const,
			valid: false,
		};
	}
	return { quote: first, valid: true };
};

const stripOuterQuote = (value: string) => {
	const quoted = hasBalancedOuterQuote(value);
	return quoted?.valid ? value.slice(1, -1) : value;
};

const splitFilterValues = (
	rawValue: string,
	key: FilterAutocompleteKey
) => {
	const quoted = hasBalancedOuterQuote(rawValue);
	const value = stripOuterQuote(rawValue);
	if (quoted?.valid && key === "path") return [value];
	return value.split(/[|,]/);
};

const normalizeAliasValue = (
	key: "in" | "type",
	value: string
) => {
	const aliases = key === "type" ? TYPE_VALUE_ALIASES : IN_VALUE_ALIASES;
	return aliases[value];
};

const normalizeFreeValue = (
	key: Exclude<FilterAutocompleteKey, "in" | "type">,
	value: string
) => {
	if (key === "ext") return value.replace(/^\./, "");
	if (key === "tag") return value.replace(/^#/, "");
	return value;
};

const uniqueValues = (values: string[]) => {
	const seen = new Set<string>();
	return values.filter((value) => {
		if (!value || seen.has(value)) return false;
		seen.add(value);
		return true;
	});
};

const analyzeEnumeratedValue = (
	key: "in" | "type",
	rawValue: string
): ValueAnalysis => {
	const quoted = hasBalancedOuterQuote(rawValue);
	if (quoted && !quoted.valid) {
		return {
			normalizedValues: [],
			reason: quoted.reason,
			status:
				quoted.reason === "unterminated-quote"
					? "value-incomplete"
					: "invalid",
			suggestions: [],
			valuePrefix: rawValue,
		};
	}

	const parts = splitFilterValues(rawValue, key).map((value) =>
		value.trim().toLowerCase()
	);
	const currentPrefix = parts[parts.length - 1] ?? "";
	const preceding = parts.slice(0, -1);
	const normalizedPreceding: string[] = [];
	for (const value of preceding) {
		const normalized = normalizeAliasValue(key, value);
		if (!normalized) {
			return {
				normalizedValues: [],
				reason: "invalid-value",
				status: "invalid",
				suggestions: [],
				valuePrefix: currentPrefix,
			};
		}
		normalizedPreceding.push(normalized);
	}

	const normalizedCurrent = normalizeAliasValue(key, currentPrefix);
	if (normalizedCurrent) {
		return {
			normalizedValues: uniqueValues([
				...normalizedPreceding,
				normalizedCurrent,
			]),
			status: "valid",
			suggestions: [],
			valuePrefix: currentPrefix,
		};
	}

	const suggestions = valueSuggestions(key, currentPrefix);
	return {
		normalizedValues: uniqueValues(normalizedPreceding),
		reason: currentPrefix ? "invalid-value" : "missing-value",
		status: suggestions.length ? "value-incomplete" : "invalid",
		suggestions,
		valuePrefix: currentPrefix,
	};
};

const analyzeFreeValue = (
	key: Exclude<FilterAutocompleteKey, "in" | "type">,
	rawValue: string
): ValueAnalysis => {
	if (!rawValue) {
		return {
			normalizedValues: [],
			reason: "missing-value",
			status: "value-incomplete",
			suggestions: [],
			valuePrefix: "",
		};
	}

	const quoted = hasBalancedOuterQuote(rawValue);
	if (quoted && !quoted.valid) {
		return {
			normalizedValues: [],
			reason: quoted.reason,
			status:
				quoted.reason === "unterminated-quote"
					? "value-incomplete"
					: "invalid",
			suggestions: [],
			valuePrefix: rawValue,
		};
	}

	const values = splitFilterValues(rawValue, key)
		.map((value) =>
			normalizeFreeValue(key, value.trim().toLowerCase())
		)
		.filter(Boolean);
	if (!values.length) {
		return {
			normalizedValues: [],
			reason: "missing-value",
			status: "value-incomplete",
			suggestions: [],
			valuePrefix: "",
		};
	}

	return {
		normalizedValues: uniqueValues(values),
		status: "valid",
		suggestions: [],
		valuePrefix: values[values.length - 1],
	};
};

const quoteValue = (value: string) =>
	/\s/u.test(value) ? `"${value}"` : value;

const serializeToken = (
	key: FilterAutocompleteKey,
	values: string[]
) => {
	const activatedKey = toActivatedKey(key);
	if (values.length === 1) {
		return `${activatedKey}:${quoteValue(values[0])}`;
	}
	return `${activatedKey}:${values.map(quoteValue).join(",")}`;
};

const activatedToken = (
	key: FilterAutocompleteKey,
	values: string[]
): ActivatedFilterToken => ({
	key: toActivatedKey(key),
	serialized: serializeToken(key, values),
	sourceKey: key,
	values: [...values],
});

export const analyzeFilterAutocomplete = (
	input: string,
	cursorOffset: number
): FilterAutocompleteState => {
	const inputToken = getTokenAtCursor(input, cursorOffset);
	const range = { from: inputToken.from, to: inputToken.to };
	const colonIndex = inputToken.raw.indexOf(":");

	if (colonIndex < 0) {
		const suggestions = keySuggestions(inputToken.raw);
		if (!suggestions.length) {
			return {
				canActivate: false,
				keyPrefix: inputToken.raw.toLowerCase(),
				range,
				rawToken: inputToken.raw,
				status: "none",
				suggestions: [],
			};
		}
		return {
			canActivate: false,
			keyPrefix: inputToken.raw.toLowerCase(),
			range,
			rawToken: inputToken.raw,
			status: "key-prefix",
			suggestions,
		};
	}

	const rawKey = inputToken.raw.slice(0, colonIndex).trim().toLowerCase();
	const rawValue = inputToken.raw.slice(colonIndex + 1);
	const suggestions = keySuggestions(rawKey);
	if (!FILTER_KEY_SET.has(rawKey)) {
		return {
			canActivate: false,
			keyPrefix: rawKey,
			range,
			rawToken: inputToken.raw,
			reason: "unknown-filter",
			status: "invalid",
			suggestions,
			valuePrefix: rawValue,
		};
	}

	const key = rawKey as FilterAutocompleteKey;
	const valueAnalysis =
		key === "in" || key === "type"
			? analyzeEnumeratedValue(key, rawValue)
			: analyzeFreeValue(key, rawValue);
	const token =
		valueAnalysis.status === "valid"
			? activatedToken(key, valueAnalysis.normalizedValues)
			: undefined;
	return {
		canActivate: !!token,
		key,
		keyPrefix: rawKey,
		range,
		rawToken: inputToken.raw,
		reason: valueAnalysis.reason,
		status: valueAnalysis.status,
		suggestions: valueAnalysis.suggestions,
		token,
		valuePrefix: valueAnalysis.valuePrefix,
	};
};

const replaceRange = (
	input: string,
	range: TextRange,
	replacement: string
) => ({
	cursorOffset: range.from + replacement.length,
	input:
		input.slice(0, range.from) +
		replacement +
		input.slice(range.to),
	range: {
		from: range.from,
		to: range.from + replacement.length,
	},
});

const activateAcceptedInput = (
	input: string,
	cursorOffset: number,
	range: TextRange,
	token: ActivatedFilterToken,
	trigger: FilterAutocompleteTrigger
): FilterAutocompleteAcceptance => {
	const replaced = replaceRange(input, range, token.serialized);
	const parsed = parseCmdkQuery(replaced.input);
	return {
		...replaced,
		kind: "activated",
		parsed,
		remainingQuery: parsed.query,
		state: analyzeFilterAutocomplete(
			replaced.input,
			replaced.cursorOffset
		),
		token,
		trigger,
	};
};

export const acceptFilterAutocomplete = (
	input: string,
	cursorOffset: number,
	trigger: FilterAutocompleteTrigger,
	suggestionId?: string
): FilterAutocompleteAcceptance | null => {
	const state = analyzeFilterAutocomplete(input, cursorOffset);
	if (state.status === "valid" && state.token && !suggestionId) {
		return activateAcceptedInput(
			input,
			cursorOffset,
			state.range,
			state.token,
			trigger
		);
	}

	const suggestion = suggestionId
		? state.suggestions.find((item) => item.id === suggestionId)
		: state.suggestions[0];
	if (!suggestion) return null;

	if (suggestion.kind === "key") {
		const colonIndex = state.rawToken.indexOf(":");
		const replacement =
			colonIndex >= 0
				? `${suggestion.key}:${state.rawToken.slice(colonIndex + 1)}`
				: suggestion.insertText;
		const replaced = replaceRange(input, state.range, replacement);
		const nextState = analyzeFilterAutocomplete(
			replaced.input,
			replaced.cursorOffset
		);
		if (nextState.status === "valid" && nextState.token) {
			return activateAcceptedInput(
				replaced.input,
				replaced.cursorOffset,
				replaced.range,
				nextState.token,
				trigger
			);
		}
		return {
			...replaced,
			kind: "continued",
			state: nextState,
			trigger,
		};
	}

	if (!state.key || !suggestion.value) return null;
	const precedingValues =
		state.key === "in" || state.key === "type"
			? analyzeEnumeratedValue(
					state.key,
					state.rawToken.slice(
						state.rawToken.indexOf(":") + 1
					)
				).normalizedValues
			: [];
	const token = activatedToken(
		state.key,
		uniqueValues([...precedingValues, suggestion.value])
	);
	return activateAcceptedInput(
		input,
		cursorOffset,
		state.range,
		token,
		trigger
	);
};

export const extractActivatedFilterTokens = (
	input: string
): ExtractedFilterTokens => {
	const matches = tokenizeInput(input)
		.map((inputToken) => ({
			inputToken,
			state: analyzeFilterAutocomplete(input, inputToken.to),
		}))
		.filter(
			(
				match
			): match is {
				inputToken: InputToken;
				state: FilterAutocompleteState & {
					token: ActivatedFilterToken;
				};
			} => match.state.canActivate && !!match.state.token
		);

	let remainingInput = input;
	for (const { inputToken } of [...matches].reverse()) {
		remainingInput =
			remainingInput.slice(0, inputToken.from) +
			remainingInput.slice(inputToken.to);
	}

	return {
		input: remainingInput.replace(/\s+/gu, " ").trim(),
		tokens: matches.map(({ state }) => state.token),
	};
};
