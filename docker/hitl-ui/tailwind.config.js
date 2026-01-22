/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary background colors
        'bg-primary': '#030303',
        'bg-secondary': '#0a0a0a',
        'bg-tertiary': '#141414',

        // Accent colors
        'accent-teal': '#1E5160',
        'accent-teal-light': '#2A7A8C',

        // Text colors
        'text-primary': '#FBFCFC',
        'text-secondary': '#A09E9D',
        'text-tertiary': '#4A4A4A',

        // Status colors
        'status-success': '#22C55E',
        'status-warning': '#F59E0B',
        'status-error': '#EF4444',
        'status-info': '#3B82F6',

        // Gate type colors
        'gate-prd': '#3B82F6',      // Blue - PRD Review
        'gate-design': '#8B5CF6',    // Purple - Design Review
        'gate-code': '#22C55E',      // Green - Code Review
        'gate-test': '#06B6D4',      // Cyan - Test Review
        'gate-deploy': '#EF4444',    // Red - Deployment
        'gate-rule': '#F97316',      // Orange - Rule Proposal (Meta-HITL)

        // Additional status colors for learning/feedback
        'learning-effective': '#10B981',     // Emerald - Rule is effective
        'learning-ineffective': '#EF4444',   // Red - Rule is ineffective
        'learning-pending': '#F59E0B',       // Amber - Rule pending review
        'learning-stabilizing': '#3B82F6',   // Blue - Rule stabilizing

        // Artifact type colors
        'artifact-prd': '#3B82F6',           // Blue
        'artifact-design': '#8B5CF6',        // Purple
        'artifact-code': '#22C55E',          // Green
        'artifact-test': '#06B6D4',          // Cyan
        'artifact-report': '#F59E0B',        // Amber
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
