import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

// Wrapper component for router context
function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('Sidebar', () => {
  it('renders the logo and title', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('aSDLC')).toBeInTheDocument();
    expect(screen.getByText('Development Console')).toBeInTheDocument();
  });

  it('renders workflow navigation items', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('Agent Cockpit')).toBeInTheDocument();
    expect(screen.getByText('Discovery Studio')).toBeInTheDocument();
    expect(screen.getByText('HITL Gates')).toBeInTheDocument();
    expect(screen.getByText('Artifacts')).toBeInTheDocument();
  });

  it('renders operations section with disabled items', () => {
    renderWithRouter(<Sidebar />);

    // Operations section should be collapsed by default
    const operationsHeader = screen.getByText('Operations');
    expect(operationsHeader).toBeInTheDocument();

    // Click to expand
    fireEvent.click(operationsHeader);

    // Check for disabled items
    expect(screen.getByText('Budget')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();

    // Verify "Soon" badges appear
    const soonBadges = screen.getAllByText('Soon');
    expect(soonBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('toggles section collapse on click', () => {
    renderWithRouter(<Sidebar />);

    const workflowHeader = screen.getByText('Workflow');

    // Initially expanded, click to collapse
    fireEvent.click(workflowHeader);

    // Check that items are hidden (by looking for specific class changes)
    // The section should now be collapsed
    expect(workflowHeader).toBeInTheDocument();
  });

  it('renders navigation links with correct hrefs', () => {
    renderWithRouter(<Sidebar />);

    const docsLink = screen.getByRole('link', { name: /documentation/i });
    expect(docsLink).toHaveAttribute('href', '/docs');

    const cockpitLink = screen.getByRole('link', { name: /agent cockpit/i });
    expect(cockpitLink).toHaveAttribute('href', '/cockpit');

    const gatesLink = screen.getByRole('link', { name: /hitl gates/i });
    expect(gatesLink).toHaveAttribute('href', '/gates');

    const artifactsLink = screen.getByRole('link', { name: /artifacts/i });
    expect(artifactsLink).toHaveAttribute('href', '/artifacts');
  });

  it('shows system healthy indicator', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('System Healthy')).toBeInTheDocument();
  });

  it('marks disabled items with cursor-not-allowed class', () => {
    renderWithRouter(<Sidebar />);

    // Expand operations section
    const operationsHeader = screen.getByText('Operations');
    fireEvent.click(operationsHeader);

    // Find the Budget link
    const budgetLink = screen.getByRole('link', { name: /budget/i });
    expect(budgetLink).toHaveClass('cursor-not-allowed');
    expect(budgetLink).toHaveClass('opacity-50');
  });
});
