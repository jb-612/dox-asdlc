/**
 * GuardrailsPage route wrapper (P11-F01 T26)
 *
 * Thin wrapper around the GuardrailsPage component for use as a
 * lazy-loaded route target. This follows the existing page pattern
 * where pages/ files serve as route-level wrappers.
 */

import { GuardrailsPage } from '../components/guardrails/GuardrailsPage';

export default function GuardrailsPageRoute() {
  return <GuardrailsPage />;
}
