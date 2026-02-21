# P14-F01: Shared Types & Validation Schemas - User Stories

**Version:** 1.0
**Date:** 2026-02-21
**Status:** COMPLETE

## Epic Summary

No user-facing stories -- this feature provides internal contracts (TypeScript types, Zod schemas, utility functions) consumed by all other P14 features.

## Internal Contracts

1. All workflow data model types are defined and exported
2. Zod validation schemas mirror TypeScript interfaces for runtime validation
3. IPC channel constants are unique and typed
4. Graph utilities (topological sort, cycle detection) are pure functions with full test coverage
5. Validation rules implement all 8 checks from the design specification
