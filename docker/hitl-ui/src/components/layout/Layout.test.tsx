import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import { useSessionStore } from '@/stores/sessionStore';
import { useTenantStore } from '@/stores/tenantStore';
import { useEventStore } from '@/stores/eventStore';

// Mock all required stores
vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: vi.fn(),
}));

vi.mock('@/stores/tenantStore', () => ({
  useTenantStore: vi.fn(),
}));

vi.mock('@/stores/eventStore', () => ({
  useEventStore: vi.fn(),
}));

const mockSessionStore = {
  environment: 'dev' as const,
  setEnvironment: vi.fn(),
  repo: 'dox-asdlc',
  setRepo: vi.fn(),
  epicId: null,
  setEpic: vi.fn(),
  currentGitSha: 'abc1234',
  currentBranch: 'main',
};

const mockTenantStore = {
  currentTenant: 'default',
  setTenant: vi.fn(),
  availableTenants: ['default'],
  multiTenancyEnabled: false,
};

const mockEventStore = {
  events: [],
  connected: true,
  reconnecting: false,
  connectionError: null,
  autoScroll: true,
  setAutoScroll: vi.fn(),
  getFilteredEvents: vi.fn(() => []),
  clearEvents: vi.fn(),
  filter: null,
  setFilter: vi.fn(),
};

function renderWithRouter(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<div>Dashboard Content</div>} />
          <Route path="/gates" element={<div>Gates Content</div>} />
          <Route path="/docs" element={<div>Docs Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSessionStore);
    (useTenantStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTenantStore);
    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockEventStore);
  });

  it('renders the sidebar', () => {
    renderWithRouter();
    expect(screen.getByText('aSDLC')).toBeInTheDocument();
    expect(screen.getByText('Development Console')).toBeInTheDocument();
  });

  it('renders the header', () => {
    renderWithRouter();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders the status bar', () => {
    renderWithRouter();
    expect(screen.getByText(/workers/)).toBeInTheDocument();
    expect(screen.getByText(/pending gates/)).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('renders outlet content', () => {
    renderWithRouter('/');
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('renders different content for different routes', () => {
    renderWithRouter('/gates');
    expect(screen.getByText('Gates Content')).toBeInTheDocument();
  });

  it('opens right panel when event panel button is clicked', async () => {
    renderWithRouter();

    // Click the events button in status bar
    const eventsButton = screen.getByText('0 events');
    fireEvent.click(eventsButton);

    // Right panel should now be visible
    expect(await screen.findByText('Live Events')).toBeInTheDocument();
  });

  it('closes right panel when close button is clicked', async () => {
    renderWithRouter();

    // Open the panel
    const eventsButton = screen.getByText('0 events');
    fireEvent.click(eventsButton);

    // Wait for panel to open
    const liveEventsTitle = await screen.findByText('Live Events');
    expect(liveEventsTitle).toBeInTheDocument();

    // Close the panel
    const closeButton = screen.getByTitle('Close panel');
    fireEvent.click(closeButton);

    // Panel should be closed (Live Events text should not be in document)
    expect(screen.queryByText('Live Events')).not.toBeInTheDocument();
  });

  it('has correct layout structure', () => {
    const { container } = renderWithRouter();

    // Should have flex container as root
    const root = container.firstChild;
    expect(root).toHaveClass('flex', 'h-screen');
  });

  it('renders navigation links in sidebar', () => {
    renderWithRouter();

    expect(screen.getByRole('link', { name: /documentation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agent cockpit/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hitl gates/i })).toBeInTheDocument();
  });
});
