/**
 * Maturity calculation algorithm for PRD Ideation Studio (P05-F11 T03)
 *
 * Provides weighted scoring for PRD maturity based on category coverage.
 * Categories have different weights reflecting their importance to a complete PRD.
 */

import type { CategoryMaturity, MaturityLevel, Gap } from '../types/ideation';
import { MATURITY_LEVELS, REQUIRED_CATEGORIES } from '../types/ideation';

/**
 * Suggested questions for each category when gaps are identified
 */
const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  problem: [
    'What specific problem are you trying to solve?',
    'Who experiences this problem and how often?',
    'What is the impact of not solving this problem?',
    'Have you tried solving this before? What happened?',
  ],
  users: [
    'Who are the primary users of this system?',
    'What are the different user roles or personas?',
    'What is the expected user volume?',
    'Are there any accessibility requirements?',
  ],
  functional: [
    'What are the core features this system must have?',
    'Can you describe the main user workflows?',
    'What integrations are needed with other systems?',
    'Are there any specific data requirements?',
  ],
  nfr: [
    'What are the performance requirements (response time, throughput)?',
    'What are the availability and uptime requirements?',
    'Are there specific security or compliance requirements?',
    'What is the expected data volume and growth rate?',
  ],
  scope: [
    'What is explicitly out of scope for this project?',
    'Are there budget or timeline constraints?',
    'What dependencies exist on other teams or systems?',
    'Are there any technical constraints to consider?',
  ],
  success: [
    'How will you measure if this project is successful?',
    'What KPIs will you track?',
    'What does "done" look like for this feature?',
    'What user outcomes are you targeting?',
  ],
  risks: [
    'What are the main risks you foresee?',
    'What assumptions are you making?',
    'What could cause this project to fail?',
    'Are there regulatory or compliance risks?',
  ],
};

/**
 * Calculate weighted maturity score from category scores.
 *
 * @param categories - Array of category maturity data
 * @returns Overall maturity score (0-100), rounded to nearest integer
 */
export function calculateMaturity(categories: CategoryMaturity[]): number {
  if (categories.length === 0) {
    return 0;
  }

  const weightedSum = categories.reduce((total, cat) => {
    return total + (cat.score * cat.weight);
  }, 0);

  // Weights should sum to 100, so divide by 100 to get percentage
  return Math.round(weightedSum / 100);
}

/**
 * Get the maturity level for a given score.
 *
 * @param score - Maturity score (0-100)
 * @returns MaturityLevel object with level, label, and description
 */
export function getMaturityLevel(score: number): MaturityLevel {
  // Clamp score to valid range
  const clampedScore = Math.max(0, Math.min(100, score));

  // Find the level where score falls within range
  // Check from highest to lowest to find the correct bracket
  for (let i = MATURITY_LEVELS.length - 1; i >= 0; i--) {
    const level = MATURITY_LEVELS[i];
    if (clampedScore >= level.minScore) {
      return level;
    }
  }

  // Fallback to concept (should not reach here with valid data)
  return MATURITY_LEVELS[0];
}

/**
 * Identify gaps in category coverage and provide suggestions.
 *
 * Severity levels:
 * - critical: Required category with score < 20
 * - moderate: Required category with score < 50, or any category with score < 30
 * - minor: Any category with score < 80
 *
 * @param categories - Array of category maturity data
 * @returns Array of gaps sorted by severity (critical first)
 */
export function identifyGaps(categories: CategoryMaturity[]): Gap[] {
  const gaps: Gap[] = [];

  for (const category of categories) {
    let severity: 'critical' | 'moderate' | 'minor' | null = null;

    if (category.requiredForSubmit) {
      if (category.score < 20) {
        severity = 'critical';
      } else if (category.score < 50) {
        severity = 'moderate';
      } else if (category.score < 80) {
        severity = 'minor';
      }
    } else {
      // Optional categories
      if (category.score < 30) {
        severity = 'moderate';
      } else if (category.score < 80) {
        severity = 'minor';
      }
    }

    if (severity) {
      gaps.push({
        categoryId: category.id,
        categoryName: category.name,
        severity,
        description: getGapDescription(category, severity),
        suggestedQuestions: SUGGESTED_QUESTIONS[category.id] || [],
      });
    }
  }

  // Sort by severity: critical > moderate > minor
  const severityOrder: Record<string, number> = {
    critical: 0,
    moderate: 1,
    minor: 2,
  };

  return gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Generate description text for a gap based on category and severity.
 */
function getGapDescription(category: CategoryMaturity, severity: 'critical' | 'moderate' | 'minor'): string {
  const requiredText = category.requiredForSubmit ? ' (required)' : '';

  switch (severity) {
    case 'critical':
      return `${category.name}${requiredText} has not been addressed. This is essential for a complete PRD.`;
    case 'moderate':
      return `${category.name}${requiredText} needs more detail (currently at ${category.score}%).`;
    case 'minor':
      return `${category.name}${requiredText} could be improved (currently at ${category.score}%).`;
    default:
      return `${category.name} needs attention.`;
  }
}

/**
 * Create initial category maturity structure with all scores at 0.
 *
 * @returns Array of CategoryMaturity with initial state
 */
export function createInitialCategories(): CategoryMaturity[] {
  return REQUIRED_CATEGORIES.map(config => ({
    id: config.id,
    name: config.name,
    score: 0,
    weight: config.weight,
    requiredForSubmit: config.requiredForSubmit,
    sections: [],
  }));
}

/**
 * Create initial maturity state for a new session.
 *
 * @returns MaturityState with 0% maturity and all categories empty
 */
export function createInitialMaturityState(): import('../types/ideation').MaturityState {
  const categories = createInitialCategories();
  const score = 0;
  const level = getMaturityLevel(score);
  const gaps = identifyGaps(categories);

  return {
    score,
    level,
    categories,
    canSubmit: false,
    gaps: gaps.map(g => g.description),
  };
}

/**
 * Update maturity state with new category scores.
 *
 * @param currentState - Current maturity state
 * @param updates - Map of category ID to new score
 * @returns Updated MaturityState
 */
export function updateMaturityState(
  currentState: import('../types/ideation').MaturityState,
  updates: Record<string, number>
): import('../types/ideation').MaturityState {
  const updatedCategories = currentState.categories.map(cat => {
    if (cat.id in updates) {
      return {
        ...cat,
        score: Math.max(0, Math.min(100, updates[cat.id])),
      };
    }
    return cat;
  });

  const score = calculateMaturity(updatedCategories);
  const level = getMaturityLevel(score);
  const gaps = identifyGaps(updatedCategories);

  return {
    score,
    level,
    categories: updatedCategories,
    canSubmit: score >= 80,
    gaps: gaps.map(g => g.description),
  };
}
