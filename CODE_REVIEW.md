### Summary

The HITL UI is a well-structured and large-scale React SPA that demonstrates a strong foundation in modern frontend practices. The architecture correctly leverages React Query for server state management and Zustand for global UI state, promoting a clean separation of concerns. The mock-first approach is robustly implemented, enabling parallel development and comprehensive testing. However, the application suffers from inconsistencies in the application of its own architectural patterns, particularly in lazy loading, error handling, and the use of shared utilities. Addressing these inconsistencies will improve bundle size, resilience, and developer velocity.

### Findings

#### [HIGH] Inconsistent Lazy Loading Strategy
- **File:** `docker/hitl-ui/src/App.tsx:21`
- **Category:** Bundle size concerns
- **Description:** Only two routes (`/architect` and `/guardrails`) are lazy-loaded using `React.lazy`. The other 20+ page components are imported statically, including other complex dashboards. This means they are all included in the initial JavaScript bundle.
- **Impact:** This significantly increases the initial bundle size, leading to longer load times for users on their first visit. It negates many of the benefits of code-splitting that Vite and React provide.
- **Recommendation:** Apply `React.lazy` and `Suspense` to all top-level page components defined as routes in `App.tsx`. Create a wrapper component or utility to reduce the boilerplate of adding `Suspense` with a `LoadingSpinner` for each route.

#### [HIGH] Sparse Error Boundary Usage
- **File:** `docker/hitl-ui/src/App.tsx:145`
- **Category:** Error boundary placement and fallback UI patterns
- **Description:** A well-implemented `ErrorBoundary` component exists but is only applied to the `/architect` route. There is no global error boundary wrapping all routes or the entire application.
- **Impact:** Any unhandled JavaScript error in a component outside the `/architect` page will crash the entire application, showing a white screen to the user. This creates a brittle and poor user experience.
- **Recommendation:** Wrap the primary `<Routes>` component or the `<Layout />` component in `App.tsx` with a global `ErrorBoundary` to catch all rendering errors and display a user-friendly fallback UI, allowing the user to at least navigate to another page or reload.

#### [MEDIUM] Conflicting React Query Configurations
- **File:** `docker/hitl-ui/src/main.tsx:6` and `docker/hitl-ui/src/api/queryClient.tsx:82`
- **Category:** State management patterns
- **Description:** `main.tsx` initializes the `QueryClient` with a default `staleTime` of 5000ms (5 seconds). However, `api/queryClient.tsx` defines a separate, more detailed configuration with a `staleTime` of 5 minutes, which appears to be intended as the application standard but is not the one being used globally.
- **Impact:** The 5-second stale time will cause more frequent background refetching of data than likely intended, leading to increased network traffic and potentially higher API costs. It also creates confusion for developers about which configuration is active.
- **Recommendation:** Consolidate all `QueryClient` configuration into `api/queryClient.tsx`. Export the configured client instance from `api/queryClient.tsx` and import it directly into `main.tsx` to be passed to the `QueryClientProvider`. The 5-minute `staleTime` is a more sensible default for most data.

#### [MEDIUM] Inconsistent Type Definition Strategy
- **File:** `docker/hitl-ui/src/api/types.ts`
- **Category:** TypeScript type safety
- **Description:** The project contains a very large, monolithic `api/types.ts` file that appears to define most of the data contracts. However, the file list also includes feature-specific type files like `docker/hitl-ui/src/types/agents.ts` and `docker/hitl-ui/src/api/types/architect.ts`. Additionally, UI-related constants (`SEVERITY_COLORS`, `REVIEWER_ICONS`) are mixed in with pure data types in `api/types.ts`.
- **Impact:** This creates ambiguity about where to find or define a type, potentially leading to duplication and making maintenance harder. Mixing UI constants with data contracts violates separation of concerns.
- **Recommendation:** Establish a single clear strategy for type definitions. Either commit to a single monolithic `types.ts` file or, preferably for a project this size, systematically break down `api/types.ts` into feature-specific files and place them in the `src/types` directory (e.g., `src/types/gates.ts`, `src/types/runs.ts`). Move UI-related constants to the components or features that use them.

#### [LOW] Inconsistent Keyboard Shortcut Implementation
- **File:** `docker/hitl-ui/src/pages/ArchitectBoardPage.tsx:43`
- **Category:** Accessibility patterns
- **Description:** The `ArchitectBoardPage` implements its own keyboard shortcut handling logic inside a `useEffect` hook, attaching event listeners directly to the DOM. The project already provides a superior, reusable `useKeyboardShortcuts` hook in `docker/hitl-ui/src/hooks/useKeyboardNavigation.tsx` which is not being used here.
- **Impact:** This leads to code duplication and inconsistency. The custom implementation is more verbose and potentially less robust than the shared hook, which already handles edge cases like not firing inside input fields.
- **Recommendation:** Refactor `ArchitectBoardPage.tsx` to use the existing `useKeyboardShortcuts` hook. This will make the code more concise, maintainable, and consistent with patterns established elsewhere in the codebase.

#### [LOW] Swallowed API Errors
- **File:** `docker/hitl-ui/src/api/agents.ts:51`
- **Category:** API layer organization
- **Description:** In `fetchAgents` and other data-fetching functions, the `catch` block logs the error to the console but then returns an empty array `[]` or `null`. The error is not re-thrown.
- **Impact:** React Query's `isError`, `error` properties and `onError` callbacks will not be triggered for the query hook, as the promise is technically resolved successfully with empty data. This can mask backend problems as simply "no data," making debugging harder and preventing the UI from showing a distinct error state to the user.
- **Recommendation:** Instead of returning a default value from the `catch` block, re-throw the error (`return Promise.reject(error);` or simply remove the `try...catch` and let the `axios` interceptor handle it). This allows React Query to manage the error state correctly, giving developers more control over the UI in error scenarios.

#### [INFO] Decentralized React Query Keys
- **File:** `docker/hitl-ui/src/api/queryClient.tsx:12` and `docker/hitl-ui/src/api/agents.ts:22`
- **Category:** State management patterns
- **Description:** The main `queryClient.tsx` file defines a `QueryKeys` factory for several features, but the `agents.ts` API file defines its own `agentsQueryKeys` object locally.
- **Impact:** This is a stylistic choice with trade-offs. Co-locating keys with API functions can be convenient, but having a central key factory can prevent collisions and provide a single overview of all cache keys. In a large team, this decentralization could lead to inconsistencies.
- **Recommendation:** The team should make a conscious decision on which pattern to follow. For a project of this scale, continuing with the co-location of keys within each API file is a reasonable strategy, but it would be beneficial to remove the partially complete key factory from `queryClient.tsx` to avoid confusion.

### Statistics
- Files reviewed: 16
- Findings by severity: CRITICAL: 0, HIGH: 2, MEDIUM: 2, LOW: 2, INFO: 1
