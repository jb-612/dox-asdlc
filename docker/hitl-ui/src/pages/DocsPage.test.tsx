/**
 * Tests for DocsPage
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DocsPage from './DocsPage';

// Wrapper component for router context
const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('DocsPage', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('docs-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByRole('heading', { level: 1, name: /documentation/i })).toBeInTheDocument();
    });

    it('renders page description', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByText(/learn about the asdlc methodology/i)).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('renders Learn and Apply tabs', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('tab-learn')).toBeInTheDocument();
      expect(screen.getByTestId('tab-apply')).toBeInTheDocument();
    });

    it('shows Learn tab as active by default', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('tab-learn')).toHaveClass('border-accent-teal');
    });

    it('switches to Apply tab on click', () => {
      renderWithRouter(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-apply'));
      expect(screen.getByTestId('tab-apply')).toHaveClass('border-accent-teal');
      expect(screen.getByTestId('tab-learn')).not.toHaveClass('border-accent-teal');
    });

    it('switches back to Learn tab on click', () => {
      renderWithRouter(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-apply'));
      fireEvent.click(screen.getByTestId('tab-learn'));
      expect(screen.getByTestId('tab-learn')).toHaveClass('border-accent-teal');
    });
  });

  describe('Learn Tab Content', () => {
    it('shows BlueprintMap in Learn tab', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('blueprint-map')).toBeInTheDocument();
    });

    it('shows MethodologyStepper in Learn tab', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('methodology-stepper')).toBeInTheDocument();
    });

    it('shows InteractiveGlossary in Learn tab', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('interactive-glossary')).toBeInTheDocument();
    });

    it('shows section headers for each component', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByText(/system overview/i)).toBeInTheDocument();
      expect(screen.getByText(/methodology stages/i)).toBeInTheDocument();
      expect(screen.getByText(/glossary/i)).toBeInTheDocument();
    });
  });

  describe('Apply Tab Content', () => {
    it('shows getting started content in Apply tab', () => {
      renderWithRouter(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-apply'));
      expect(screen.getByText(/getting started/i)).toBeInTheDocument();
    });

    it('shows quick actions in Apply tab', () => {
      renderWithRouter(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-apply'));
      expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
    });

    it('shows common workflows in Apply tab', () => {
      renderWithRouter(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-apply'));
      expect(screen.getByText(/common workflows/i)).toBeInTheDocument();
    });
  });

  describe('BlueprintMap Data', () => {
    it('shows Discovery cluster', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('cluster-discovery')).toBeInTheDocument();
    });

    it('shows Design cluster', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('cluster-design')).toBeInTheDocument();
    });

    it('shows Development cluster', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('cluster-development')).toBeInTheDocument();
    });

    it('shows Validation cluster', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('cluster-validation')).toBeInTheDocument();
    });
  });

  describe('MethodologyStepper Data', () => {
    it('shows Requirements stage', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('stage-requirements')).toBeInTheDocument();
    });

    it('shows all 8 stages', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByText(/stage 1 of 8/i)).toBeInTheDocument();
    });
  });

  describe('Glossary Data', () => {
    it('shows glossary search', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('glossary-search')).toBeInTheDocument();
    });

    it('shows category filters', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('category-all')).toBeInTheDocument();
      expect(screen.getByTestId('category-concept')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('BlueprintMap is interactive', () => {
      renderWithRouter(<DocsPage />);
      const cluster = screen.getByTestId('cluster-discovery');
      fireEvent.click(cluster);
      expect(screen.getByTestId('cluster-items-discovery')).toBeInTheDocument();
    });

    it('MethodologyStepper navigation works', () => {
      renderWithRouter(<DocsPage />);
      const nextButton = screen.getByTestId('next-button');
      fireEvent.click(nextButton);
      expect(screen.getByText(/stage 2 of 8/i)).toBeInTheDocument();
    });

    it('Glossary search works', () => {
      renderWithRouter(<DocsPage />);
      const searchInput = screen.getByTestId('glossary-search');
      fireEvent.change(searchInput, { target: { value: 'agent' } });
      // Should filter results
      expect(screen.getByText('Agent')).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('applies responsive grid classes', () => {
      renderWithRouter(<DocsPage />);
      const page = screen.getByTestId('docs-page');
      expect(page).toHaveClass('max-w-7xl');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithRouter(<DocsPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
    });

    it('tabs have proper role', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('tab-learn')).toHaveAttribute('role', 'tab');
      expect(screen.getByTestId('tab-apply')).toHaveAttribute('role', 'tab');
    });

    it('tablist has proper role', () => {
      renderWithRouter(<DocsPage />);
      expect(screen.getByTestId('tabs-container')).toHaveAttribute('role', 'tablist');
    });
  });
});
