import type { SearchResult, TFile } from "obsidian";
import type { CmdkRagHit } from "./ragBridge";

export type CmdkSearchType = "file" | "heading" | "content";
export type CmdkSearchField = "name" | "path" | "heading" | "content";

export interface CmdkSearchFilters {
	file: boolean;
	heading: boolean;
	content: boolean;
}

interface CmdkResultBase {
	nameMatch: SearchResult | null;
	pathMatch: SearchResult | null;
	childOf?: string;
	pinned?: boolean;
	score?: number;
	section?: string;
}

export interface CmdkFileResult extends CmdkResultBase {
	childResults?: SearchableCmdkResult[];
	expanded?: boolean;
	file: TFile;
	matchCount?: number;
	previewResult?: SearchableCmdkResult;
	type: "file";
}

export interface CmdkHeadingResult extends CmdkResultBase {
	isAlias?: boolean;
	file: TFile;
	nameMatch: null;
	pathMatch: null;
	type: "heading";
	heading: string;
	headingMatch: SearchResult | null;
	level?: number;
	line?: number;
}

export interface CmdkContentResult extends CmdkResultBase {
	file: TFile;
	nameMatch: null;
	pathMatch: null;
	type: "content";
	content: string;
	contentMatch: SearchResult | null;
	line: number;
}

export interface CmdkCommandResult extends CmdkResultBase {
	nameMatch: null;
	pathMatch: null;
	type: "command";
	commandId: string;
	title: string;
	icon?: string;
}

export interface CmdkHistoryResult extends CmdkResultBase {
	nameMatch: null;
	pathMatch: null;
	type: "history";
	query: string;
}

export interface CmdkCreateResult extends CmdkResultBase {
	nameMatch: null;
	pathMatch: null;
	type: "create";
	createQuery: string;
}

export interface CmdkRagResult extends CmdkResultBase {
	file: TFile;
	hit: CmdkRagHit;
	nameMatch: null;
	pathMatch: null;
	previewResult: SearchableCmdkResult;
	type: "rag";
}

export type CmdkLoadMoreTarget = "children" | "files" | "rag";

export interface CmdkLoadMoreResult extends CmdkResultBase {
	filePath?: string;
	label: string;
	nameMatch: null;
	pathMatch: null;
	remaining: number;
	target: CmdkLoadMoreTarget;
	type: "load-more";
}

export type SearchableCmdkResult =
	| CmdkFileResult
	| CmdkHeadingResult
	| CmdkContentResult;

export type CmdkResult =
	| SearchableCmdkResult
	| CmdkCommandResult
	| CmdkHistoryResult
	| CmdkCreateResult
	| CmdkRagResult
	| CmdkLoadMoreResult;

export const isSearchableCmdkResult = (
	result: CmdkResult
): result is SearchableCmdkResult =>
	result.type === "file" ||
	result.type === "heading" ||
	result.type === "content";

export const isCreateCmdkResult = (
	result: CmdkResult
): result is CmdkCreateResult => result.type === "create";

export const isCommandCmdkResult = (
	result: CmdkResult
): result is CmdkCommandResult => result.type === "command";
