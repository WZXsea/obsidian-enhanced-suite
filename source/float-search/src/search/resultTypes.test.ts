import { describe, expect, it } from "vitest";
import {
	isCommandCmdkResult,
	isCreateCmdkResult,
	isSearchableCmdkResult,
	type CmdkResult,
} from "./resultTypes";

const baseResult = {
	nameMatch: null,
	pathMatch: null,
};

describe("CMDK result type guards", () => {
	it("identifies searchable file, heading, and content results", () => {
		const results = [
			{ ...baseResult, file: {}, type: "file" },
			{
				...baseResult,
				file: {},
				heading: "Heading",
				headingMatch: null,
				type: "heading",
			},
			{
				...baseResult,
				file: {},
				content: "Content",
				contentMatch: null,
				line: 1,
				type: "content",
			},
			{
				...baseResult,
				commandId: "float-search:test",
				title: "Test",
				type: "command",
			},
			{ ...baseResult, query: "tag:#course", type: "history" },
			{ ...baseResult, createQuery: "New note", type: "create" },
			{
				...baseResult,
				file: {},
				hit: {},
				previewResult: { ...baseResult, file: {}, type: "file" },
				type: "rag",
			},
		] as CmdkResult[];

		expect(results.map(isSearchableCmdkResult)).toEqual([
			true,
			true,
			true,
			false,
			false,
			false,
			false,
		]);
	});

	it("identifies command and create results independently", () => {
		const command = {
			...baseResult,
			commandId: "float-search:test",
			title: "Test",
			type: "command",
		} as CmdkResult;
		const create = {
			...baseResult,
			createQuery: "New note",
			type: "create",
		} as CmdkResult;

		expect(isCommandCmdkResult(command)).toBe(true);
		expect(isCommandCmdkResult(create)).toBe(false);
		expect(isCreateCmdkResult(create)).toBe(true);
		expect(isCreateCmdkResult(command)).toBe(false);
	});
});
