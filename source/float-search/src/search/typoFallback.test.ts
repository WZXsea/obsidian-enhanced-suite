import { describe, expect, it } from "vitest";
import type { SearchStage } from "./searchSession";
import {
	getTypoFallbackDelay,
	shouldRunTypoFallback,
} from "./typoFallback";

const completed = new Set<SearchStage>(["file", "heading", "content"]);

describe("typo fallback gating", () => {
	it("runs only after primary stages with fewer than 20 files", () => {
		expect(
			shouldRunTypoFallback({
				completedStages: completed,
				contentEnabled: true,
				distinctPrimaryFiles: 19,
				enabled: true,
				matcherEligible: true,
			})
		).toBe(true);
		expect(
			shouldRunTypoFallback({
				completedStages: completed,
				contentEnabled: true,
				distinctPrimaryFiles: 20,
				enabled: true,
				matcherEligible: true,
			})
		).toBe(false);
	});

	it("rejects disabled, ineligible, or incomplete searches", () => {
		for (const override of [
			{ enabled: false },
			{ contentEnabled: false },
			{ matcherEligible: false },
			{ completedStages: new Set<SearchStage>(["file", "heading"]) },
		]) {
			expect(
				shouldRunTypoFallback({
					completedStages: completed,
					contentEnabled: true,
					distinctPrimaryFiles: 0,
					enabled: true,
					matcherEligible: true,
					...override,
				})
			).toBe(false);
		}
	});

	it("waits only for the remaining stability interval", () => {
		expect(getTypoFallbackDelay(100, 200)).toBe(250);
		expect(getTypoFallbackDelay(100, 450)).toBe(0);
		expect(getTypoFallbackDelay(100, 50)).toBe(350);
	});
});
