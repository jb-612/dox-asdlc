/**
 * Tests for ArtifactsPage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArtifactsPage from './ArtifactsPage';

// Mock child components
vi.mock('../components/artifacts/ArtifactExplorer', () => ({
  default: () => <div data-testid="artifact-explorer">ArtifactExplorer</div>,
}));

vi.mock('../components/artifacts/SpecIndexBrowser', () => ({
  default: () => <div data-testid="spec-index-browser">SpecIndexBrowser</div>,
}));

const renderPage = () => {
  return render(
    <MemoryRouter>
      <ArtifactsPage />
    </MemoryRouter>
  );
};

describe('ArtifactsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderPage();
      expect(screen.getByTestId('artifacts-page')).toBeInTheDocument();
    });

    it('displays page title', () => {
      renderPage();
      expect(screen.getByText('Artifacts')).toBeInTheDocument();
    });

    it('displays page description', () => {
      renderPage();
      expect(screen.getByText(/browse and manage/i)).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('renders both tabs', () => {
      renderPage();
      expect(screen.getByTestId('tab-explorer')).toBeInTheDocument();
      expect(screen.getByTestId('tab-spec-index')).toBeInTheDocument();
    });

    it('shows explorer tab by default', () => {
      renderPage();
      expect(screen.getByTestId('artifact-explorer')).toBeInTheDocument();
    });

    it('switches to spec index tab when clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('tab-spec-index'));

      expect(screen.getByTestId('spec-index-browser')).toBeInTheDocument();
      expect(screen.queryByTestId('artifact-explorer')).not.toBeInTheDocument();
    });

    it('switches back to explorer when clicked', () => {
      renderPage();

      // Switch to spec index
      fireEvent.click(screen.getByTestId('tab-spec-index'));
      expect(screen.getByTestId('spec-index-browser')).toBeInTheDocument();

      // Switch back to explorer
      fireEvent.click(screen.getByTestId('tab-explorer'));
      expect(screen.getByTestId('artifact-explorer')).toBeInTheDocument();
    });

    it('highlights active tab', () => {
      renderPage();
      const explorerTab = screen.getByTestId('tab-explorer');
      expect(explorerTab).toHaveClass('border-accent-blue');
    });

    it('updates tab highlight when switching', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('tab-spec-index'));

      const specTab = screen.getByTestId('tab-spec-index');
      expect(specTab).toHaveClass('border-accent-blue');
    });
  });

  describe('Tab Labels', () => {
    it('shows explorer tab label', () => {
      renderPage();
      expect(screen.getByText('Explorer')).toBeInTheDocument();
    });

    it('shows spec index tab label', () => {
      renderPage();
      expect(screen.getByText('Spec Index')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('tabs are keyboard navigable with Enter', () => {
      renderPage();
      const specTab = screen.getByTestId('tab-spec-index');

      fireEvent.keyDown(specTab, { key: 'Enter' });

      expect(screen.getByTestId('spec-index-browser')).toBeInTheDocument();
    });

    it('tabs are keyboard navigable with Space', () => {
      renderPage();
      const specTab = screen.getByTestId('tab-spec-index');

      fireEvent.keyDown(specTab, { key: ' ' });

      expect(screen.getByTestId('spec-index-browser')).toBeInTheDocument();
    });
  });

  describe('Header Actions', () => {
    it('shows create artifact button', () => {
      renderPage();
      expect(screen.getByTestId('create-artifact-btn')).toBeInTheDocument();
    });

    it('shows refresh button', () => {
      renderPage();
      expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
    });
  });
});
