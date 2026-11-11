import { describe, expect, it } from "vitest";
import { scoreCmdkText } from "./scoring";
import {
	prepareTypoMatcher,
	scoreTypoMatch,
	typoMatch,
} from "./typoSearch";

describe("typoMatch", () => {
	it("prepares query eligibility once and reuses it across texts", () => {
		const matcher = prepareTypoMatcher("治疗方案");
		expect(matcher.isEligible).toBe(true);
		expect(matcher.match("常见的治疗方按需要复核")?.distance).toBe(1);
		expect(matcher.match("完全无关的文本")).toBeNull();
	});

	it("keeps mixed-query eligibility on the prepared matcher", () => {
		expect(prepareTypoMatcher("a中").isEligible).toBe(false);
		expect(prepareTypoMatcher("ab中文").isEligible).toBe(true);
	});

	it("matches one substituted Chinese character", () => {
		const match = typoMatch("气官切开", "气管切开");

		expect(match?.distance).toBe(1);
		expect(match?.matchedText).toBe("气管切开");
	});

	it("matches one missing Chinese character", () => {
		const match = typoMatch("气切开", "气管切开");

		expect(match?.distance).toBe(1);
		expect(match?.matchedText).toBe("气管切开");
	});

	it("matches one extra Chinese character", () => {
		const match = typoMatch("气管插切开", "气管切开");

		expect(match?.distance).toBe(1);
		expect(match?.matchedText).toBe("气管切开");
	});

	it("handles common heading typos", () => {
		const match = typoMatch("眼检疾病", "眼睑疾病");

		expect(match?.distance).toBe(1);
		expect(match?.matchedText).toBe("眼睑疾病");
	});

	it("allows the first character of a three-character Chinese term to be mistyped", () => {
		const match = typoMatch("偏桃体", "扁桃体恶性肿瘤");

		expect(match?.distance).toBe(1);
		expect(match?.matchedText).toBe("扁桃体");
	});

	it("keeps short queries out of typo mode", () => {
		expect(typoMatch("肿瘤", "肺肿瘤")).toBeNull();
		expect(typoMatch("abc", "abd")).toBeNull();
	});

	it("rejects matches beyond one edit", () => {
		expect(typoMatch("甲乙丙", "甲丁戊")).toBeNull();
	});

	it("supports mixed Chinese and Latin/digit typo queries after the length guard", () => {
		const egfr = typoMatch("EGFR突弯", "EGFR突变治疗");
		const pdl = typoMatch("PDL2表达", "PDL1表达");

		expect(egfr?.distance).toBe(1);
		expect(pdl?.distance).toBe(1);
	});

	it("scores exact typo-helper matches above edited matches", () => {
		const exact = typoMatch("气管切开", "气管切开");
		const edited = typoMatch("气官切开", "气管切开");

		expect(exact).not.toBeNull();
		expect(edited).not.toBeNull();
		if (!exact || !edited) return;
		expect(scoreTypoMatch("气管切开", "气管切开", exact)).toBeGreaterThan(
			scoreTypoMatch("气官切开", "气管切开", edited)
		);
	});

	it("keeps normal command palette scores above typo fallback scores", () => {
		const normal = scoreCmdkText("扁桃体", "扁桃体恶性肿瘤");
		const typo = typoMatch("偏桃体", "扁桃体恶性肿瘤");

		expect(typo).not.toBeNull();
		if (!typo) return;
		expect(normal).toBeGreaterThan(typo.score);
	});
});
