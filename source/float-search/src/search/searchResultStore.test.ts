import { describe, expect, it } from "vitest";
import {
	SearchResultStore,
	type SearchResultBucket,
} from "./searchResultStore";

interface TestResult {
	id: string;
	label: string;
	section?: string;
}

const result = (id: string, label = id): TestResult => ({ id, label });

const createStore = (outputOrder?: readonly SearchResultBucket[]) =>
	new SearchResultStore<TestResult>({
		getKey: (item) => item.id,
		outputOrder,
	});

describe("SearchResultStore", () => {
	it("incrementally upserts lexical results by an injected stable key", () => {
		const store = createStore();
		const first = result("a", "first");
		const second = result("b");
		const updated = result("a", "updated");

		expect(store.upsertLexical([first, second])).toBe(true);
		expect(store.upsertLexical([first])).toBe(false);
		expect(store.upsertLexical([updated])).toBe(true);
		expect(store.getCategory("lexical")).toEqual([updated, second]);
	});

	it("atomically replaces categories and reports no-op replacements", () => {
		const store = createStore();
		const first = result("rag-a");
		const second = result("rag-b");

		expect(store.replaceCategory("rag", [first, second])).toBe(true);
		expect(store.replaceCategory("rag", [first, second])).toBe(false);
		expect(store.replaceCategory("rag", [second])).toBe(true);
		expect(store.getCategory("rag")).toEqual([second]);
	});

	it("deduplicates within a category using the last value", () => {
		const store = createStore();
		const first = result("same", "first");
		const replacement = result("same", "replacement");

		store.replaceCategory("history", [
			first,
			result("other"),
			replacement,
		]);

		expect(store.getCategory("history")).toEqual([
			replacement,
			result("other"),
		]);
	});

	it("outputs pinned results first without removing ordinary results", () => {
		const store = createStore(["create", "lexical", "pinned"]);
		const pinned = result("same", "pinned");
		const ordinary = result("same", "ordinary");
		const create = result("create");

		store.replaceCategory("pinned", [pinned]);
		store.upsertLexical([ordinary]);
		store.replaceCategory("create", [create]);

		expect(store.getResults()).toEqual([pinned, create, ordinary]);
		expect(store.size).toBe(3);
	});

	it("does not add rendering state or clone result objects", () => {
		const store = createStore();
		const lexical = result("plain");

		store.upsertLexical([lexical]);
		const stored = store.getResults()[0];

		expect(stored).toBe(lexical);
		expect(stored).toEqual({ id: "plain", label: "plain" });
		expect(stored.section).toBeUndefined();
	});

	it("returns snapshots that callers cannot use to mutate buckets", () => {
		const store = createStore();
		store.upsertLexical([result("a")]);

		const snapshot = store.getCategory("lexical");
		snapshot.push(result("external"));

		expect(store.getCategory("lexical").map((item) => item.id)).toEqual([
			"a",
		]);
	});

	it("clears individual categories and the complete store", () => {
		const store = createStore();
		store.upsertLexical([result("lexical")]);
		store.replaceCategory("rag", [result("rag")]);

		expect(store.clearCategory("rag")).toBe(true);
		expect(store.clearCategory("rag")).toBe(false);
		expect(store.size).toBe(1);
		expect(store.clear()).toBe(true);
		expect(store.clear()).toBe(false);
		expect(store.getResults()).toEqual([]);
	});
});
