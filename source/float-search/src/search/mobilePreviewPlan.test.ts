import {describe, expect, it} from "vitest";
import {planMobilePreview, PREVIEW_FRAGMENT_CHARS, previewTargetFragment, previewTargetOffset} from "./mobilePreviewPlan";

describe("mobile preview fragment planning", () => {
	it("hides YAML while retaining source line coordinates", () => {
		const plan = planMobilePreview("---\r\ntitle: hidden\r\n---\r\n# Visible\r\nmatched body");
		expect(plan.contentStart).toBe(3);
		expect(plan.lineStarts).toEqual([0, 4, 18, 22, 32]);
		expect(plan.fragments.map(fragment => fragment.text).join("")).toBe("# Visible\nmatched body");
		expect(plan.fragments[0].startLine).toBe(3);
		expect(previewTargetOffset(plan, {line: 4, matchText: "body"})).toBe(plan.source.indexOf("body"));
	});

	it("bounds ordinary documents below the previous full-render threshold with continuous coverage", () => {
		const source = Array.from({length: 350}, (_, index) => `## Section ${index}\n\n${"正文".repeat(50)}\n\n`).join("");
		const plan = planMobilePreview(source);
		expect(source.length).toBeLessThan(60000);
		expect(plan.fragments.length).toBeGreaterThan(1);
		expect(plan.fragments.every(fragment => fragment.text.length <= PREVIEW_FRAGMENT_CHARS)).toBe(true);
		expect(plan.fragments.map(fragment => fragment.text).join("")).toBe(source);
		for (let index = 1; index < plan.fragments.length; index++) {
			expect(plan.fragments[index].start).toBe(plan.fragments[index - 1].end);
		}
	});

	it("keeps complete ordinary code, math, table and list blocks together", () => {
		const blocks = [
			"```ts\nconst value = 1;\n\nconsole.log(value);\n```\n",
			"$$\na + b = c\n$$\n",
			"| Name | Value |\n| --- | --- |\n| A | 1 |\n| B | 2 |\n",
			"- Parent\n  - Child\n  - Another child\n- Next parent\n",
		];
		const plan = planMobilePreview(blocks.map(block => `${"前文".repeat(1500)}\n\n${block}\n`).join(""));
		for (const block of blocks) {
			expect(plan.fragments.some(fragment => !fragment.plain && fragment.text.includes(block))).toBe(true);
		}
	});

	it("bounds oversized blocks without losing source or splitting surrogate pairs", () => {
		const source = `\`\`\`text\n${"🙂".repeat(7000)}\n\`\`\``;
		const plan = planMobilePreview(source);
		expect(plan.fragments.every(fragment => fragment.plain && fragment.text.length <= PREVIEW_FRAGMENT_CHARS)).toBe(true);
		expect(plan.fragments.map(fragment => fragment.text).join("")).toBe(source);
		for (const fragment of plan.fragments) {
			expect(/[\uD800-\uDBFF]$/.test(fragment.text)).toBe(false);
			expect(/^[\uDC00-\uDFFF]/.test(fragment.text)).toBe(false);
		}
	});

	it("selects a long-line tail match instead of the first page", () => {
		const source = `  ${"开头".repeat(7000)}目标命中末尾`;
		const plan = planMobilePreview(source);
		const target = {line: 0, matchText: "目标命中"};
		const position = previewTargetOffset(plan, target);
		const fragment = plan.fragments[previewTargetFragment(plan, target)];
		expect(position).toBe(source.indexOf("目标命中"));
		expect(fragment.text).toContain("目标命中");
		expect(fragment.start).toBeGreaterThan(0);
		expect(previewTargetOffset(plan, {line: 0, matchOffset: 14000})).toBe(14002);
	});

	it("supports empty and metadata-only notes", () => {
		for (const source of ["", "---\ntitle: empty\n---"]) {
			const plan = planMobilePreview(source);
			expect(plan.fragments).toHaveLength(1);
			expect(plan.fragments[0].text).toBe("");
			expect(previewTargetFragment(plan, {})).toBe(0);
		}
	});
});
