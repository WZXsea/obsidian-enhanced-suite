import type { SearchStage } from "./searchSession";

export interface TypoFallbackDecision {
	contentEnabled: boolean;
	distinctPrimaryFiles: number;
	enabled: boolean;
	matcherEligible: boolean;
	completedStages: ReadonlySet<SearchStage>;
}

const REQUIRED_PRIMARY_STAGES: SearchStage[] = [
	"file",
	"heading",
	"content",
];

export const shouldRunTypoFallback = ({
	contentEnabled,
	distinctPrimaryFiles,
	enabled,
	matcherEligible,
	completedStages,
}: TypoFallbackDecision) =>
	enabled &&
	contentEnabled &&
	matcherEligible &&
	distinctPrimaryFiles < 20 &&
	REQUIRED_PRIMARY_STAGES.every((stage) => completedStages.has(stage));

export const getTypoFallbackDelay = (
	startedAt: number,
	now: number,
	minimumStableMs = 350
) => Math.max(0, minimumStableMs - Math.max(0, now - startedAt));
