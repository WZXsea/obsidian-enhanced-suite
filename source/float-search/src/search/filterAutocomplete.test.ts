import { describe, expect, it } from "vitest";
import {
	FILTER_AUTOCOMPLETE_KEYS,
	acceptFilterAutocomplete,
	analyzeFilterAutocomplete,
	extractActivatedFilterTokens,
} from "./filterAutocomplete";

describe("analyzeFilterAutocomplete", () => {
	it("offers all supported filter keys at an empty token", () => {
		const state = analyzeFilterAutocomplete("body ", 5);

		expect(state.status).toBe("key-prefix");
		expect(state.range).toEqual({ from: 5, to: 5 });
		expect(state.suggestions.map((item) => item.key)).toEqual(
			FILTER_AUTOCOMPLETE_KEYS
		);
	});

	it("finds a key prefix at the cursor without treating body text as a token", () => {
		const input = "alpha ty omega";
		const state = analyzeFilterAutocomplete(input, 8);

		expect(state.status).toBe("key-prefix");
		expect(state.rawToken).toBe("ty");
		expect(state.range).toEqual({ from: 6, to: 8 });
		expect(state.suggestions.map((item) => item.id)).toEqual([
			"key:type",
		]);

		expect(analyzeFilterAutocomplete(input, input.length).status).toBe(
			"none"
		);
	});

	it("provides enumerated value suggestions and normalizes aliases", () => {
		const incomplete = analyzeFilterAutocomplete("type:hea", 8);
		expect(incomplete).toMatchObject({
			canActivate: false,
			key: "type",
			reason: "invalid-value",
			status: "value-incomplete",
			valuePrefix: "hea",
		});
		expect(incomplete.suggestions.map((item) => item.value)).toEqual([
			"heading",
		]);

		const valid = analyzeFilterAutocomplete(
			"type:files,headings",
			19
		);
		expect(valid.status).toBe("valid");
		expect(valid.token).toEqual({
			key: "type",
			serialized: "type:file,heading",
			sourceKey: "type",
			values: ["file", "heading"],
		});
	});

	it("reports incomplete and invalid tokens for UI display", () => {
		expect(analyzeFilterAutocomplete("path:", 5)).toMatchObject({
			reason: "missing-value",
			status: "value-incomplete",
		});
		expect(
			analyzeFilterAutocomplete('path:"Course Wiki', 17)
		).toMatchObject({
			reason: "unterminated-quote",
			status: "value-incomplete",
		});
		expect(analyzeFilterAutocomplete("unknown:value", 13)).toMatchObject({
			reason: "unknown-filter",
			status: "invalid",
		});
		expect(analyzeFilterAutocomplete("type:unknown", 12)).toMatchObject({
			reason: "invalid-value",
			status: "invalid",
		});
	});

	it("keeps quoted path tokens intact and normalizes free values", () => {
		const input = 'alpha path:"Course Wiki" omega';
		const state = analyzeFilterAutocomplete(input, 18);

		expect(state.range).toEqual({ from: 6, to: 24 });
		expect(state.token).toEqual({
			key: "path",
			serialized: 'path:"course wiki"',
			sourceKey: "path",
			values: ["course wiki"],
		});

		expect(analyzeFilterAutocomplete("ext:.MD,pdf", 11).token).toEqual({
			key: "ext",
			serialized: "ext:md,pdf",
			sourceKey: "ext",
			values: ["md", "pdf"],
		});
		expect(analyzeFilterAutocomplete("tag:#Topic,topic", 16).token).toEqual({
			key: "tag",
			serialized: "tag:topic",
			sourceKey: "tag",
			values: ["topic"],
		});
	});
});

describe("acceptFilterAutocomplete", () => {
	it("accepts a key candidate and leaves an incomplete token for value input", () => {
		const accepted = acceptFilterAutocomplete(
			"alpha ty omega",
			8,
			"Tab",
			"key:type"
		);

		expect(accepted).toMatchObject({
			cursorOffset: 11,
			input: "alpha type: omega",
			kind: "continued",
			range: { from: 6, to: 11 },
			trigger: "Tab",
		});
		expect(accepted?.state.status).toBe("value-incomplete");
	});

	it("accepts a value candidate as a normalized active token", () => {
		const accepted = acceptFilterAutocomplete(
			"alpha type:hea omega",
			14,
			"Enter",
			"value:type:heading"
		);

		expect(accepted).toMatchObject({
			input: "alpha type:heading omega",
			kind: "activated",
			remainingQuery: "alpha omega",
			token: {
				key: "type",
				serialized: "type:heading",
				sourceKey: "type",
				values: ["heading"],
			},
			trigger: "Enter",
		});
		expect(accepted?.parsed?.types).toEqual(new Set(["heading"]));
	});

	it("activates and normalizes an already complete token", () => {
		const accepted = acceptFilterAutocomplete(
			'find path:"Course Wiki" ext:.MD',
			23,
			"Tab"
		);

		expect(accepted).toMatchObject({
			input: 'find path:"course wiki" ext:.MD',
			kind: "activated",
			remainingQuery: "find",
			token: {
				key: "path",
				serialized: 'path:"course wiki"',
				sourceKey: "path",
				values: ["course wiki"],
			},
		});
		expect(accepted?.parsed?.pathIncludes).toEqual(["course wiki"]);
	});

	it("keeps shorthand filter semantics compatible with queryParser", () => {
		const accepted = acceptFilterAutocomplete(
			"before head:Diagnosis after",
			21,
			"Enter"
		);

		expect(accepted).toMatchObject({
			input: "before heading:diagnosis after",
			remainingQuery: "before diagnosis after",
			token: {
				key: "heading",
				serialized: "heading:diagnosis",
				sourceKey: "head",
				values: ["diagnosis"],
			},
		});
		expect(accepted?.parsed?.types).toEqual(new Set(["heading"]));
		expect(accepted?.parsed?.fields).toEqual(new Set(["heading"]));
	});

	it("repairs an incomplete key before continuing value completion", () => {
		const accepted = acceptFilterAutocomplete(
			"typ:hea",
			7,
			"Tab",
			"key:type"
		);

		expect(accepted).toMatchObject({
			input: "type:hea",
			kind: "continued",
		});
		expect(accepted?.state.suggestions.map((item) => item.id)).toEqual([
			"value:type:heading",
		]);
	});

	it("returns null when an incomplete free-form value cannot be accepted", () => {
		expect(
			acceptFilterAutocomplete("path:", 5, "Enter")
		).toBeNull();
	});
});

describe("extractActivatedFilterTokens", () => {
	it("hydrates valid filters while preserving the remaining query", () => {
		const extracted = extractActivatedFilterTokens(
			'alpha path:"Course Wiki" type:files ext:.MD beta'
		);

		expect(extracted.input).toBe("alpha beta");
		expect(extracted.tokens.map((token) => token.serialized)).toEqual([
			'path:"course wiki"',
			"type:file",
			"ext:md",
		]);
	});

	it("leaves incomplete and invalid filter text editable", () => {
		const extracted = extractActivatedFilterTokens(
			"path: type:unknown query"
		);

		expect(extracted.input).toBe("path: type:unknown query");
		expect(extracted.tokens).toEqual([]);
	});
});
