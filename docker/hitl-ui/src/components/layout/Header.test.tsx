import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import { useSessionStore } from '@/stores/sessionStore';
import { useTenantStore } from '@/stores/tenantStore';

// Mock the stores
vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: vi.fn(),
}));

vi.mock('@/stores/tenantStore', () => ({
  useTenantStore: vi.fn(),
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
  availableTenants: ['default', 'tenant-a'],
  multiTenancyEnabled: false,
};

function renderWithRouter(component: React.ReactElement, initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      {component}
    </MemoryRouter>
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSessionStore);
    (useTenantStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTenantStore);
  });

  it('renders the page title based on route', () => {
    renderWithRouter(<Header />, '/');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders different page titles for different routes', () => {
    renderWithRouter(<Header />, '/gates');
    expect(screen.getByText('HITL Gates')).toBeInTheDocument();
  });

  it('renders environment selector with current environment', () => {
    renderWithRouter(<Header />);
    expect(screen.getByText('dev')).toBeInTheDocument();
  });

  it('renders repo selector with current repo', () => {
    renderWithRouter(<Header />);
    expect(screen.getByText('dox-asdlc')).toBeInTheDocument();
  });

  it('renders epic selector with placeholder when no epic selected', () => {
    renderWithRouter(<Header />);
    expect(screen.getByText('All epics')).toBeInTheDocument();
  });

  it('renders user menu with operator name', () => {
    renderWithRouter(<Header />);
    expect(screen.getByText('Operator')).toBeInTheDocument();
  });

  it('opens user menu dropdown on click', () => {
    renderWithRouter(<Header />);

    const userButton = screen.getByText('Operator');
    fireEvent.click(userButton);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows tenant selector when multi-tenancy is enabled', () => {
    (useTenantStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockTenantStore,
      multiTenancyEnabled: true,
    });

    renderWithRouter(<Header />);
    expect(screen.getByText('Tenant:')).toBeInTheDocument();
  });

  it('hides tenant selector when multi-tenancy is disabled', () => {
    renderWithRouter(<Header />);
    expect(screen.queryByText('Tenant:')).not.toBeInTheDocument();
  });

  it('shows environment with appropriate color class', () => {
    (useSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockSessionStore,
      environment: 'prod',
    });

    renderWithRouter(<Header />);
    const prodText = screen.getByText('prod');
    expect(prodText).toHaveClass('text-status-error');
  });

  it('calls setEnvironment when environment is changed', async () => {
    const setEnvironmentMock = vi.fn();
    (useSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockSessionStore,
      setEnvironment: setEnvironmentMock,
    });

    renderWithRouter(<Header />);

    // Click the environment selector button
    const envButton = screen.getByText('dev').closest('button');
    if (envButton) {
      fireEvent.click(envButton);
    }

    // Select staging
    const stagingOption = await screen.findByText('staging');
    fireEvent.click(stagingOption);

    expect(setEnvironmentMock).toHaveBeenCalledWith('staging');
  });

  it('displays current tenant in selector', () => {
    (useTenantStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockTenantStore,
      multiTenancyEnabled: true,
      currentTenant: 'acme-corp',
    });

    renderWithRouter(<Header />);
    expect(screen.getByText('acme-corp')).toBeInTheDocument();
  });

  it('calls setTenant when tenant is changed', async () => {
    const setTenantMock = vi.fn();
    (useTenantStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockTenantStore,
      multiTenancyEnabled: true,
      setTenant: setTenantMock,
    });

    renderWithRouter(<Header />);

    // Click the tenant selector button
    const tenantButton = screen.getByText('Tenant:').closest('button');
    if (tenantButton) {
      fireEvent.click(tenantButton);
    }

    // Select a different tenant
    const tenantOption = await screen.findByText('tenant-a');
    fireEvent.click(tenantOption);

    expect(setTenantMock).toHaveBeenCalledWith('tenant-a');
  });

  it('shows all available tenants in dropdown', async () => {
    (useTenantStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockTenantStore,
      multiTenancyEnabled: true,
      availableTenants: ['default', 'tenant-a', 'tenant-b', 'acme-corp'],
    });

    renderWithRouter(<Header />);

    // Click the tenant selector button
    const tenantButton = screen.getByText('Tenant:').closest('button');
    if (tenantButton) {
      fireEvent.click(tenantButton);
    }

    // All tenants should be visible in the dropdown (default appears twice: current + dropdown)
    const defaultElements = await screen.findAllByText('default');
    expect(defaultElements.length).toBeGreaterThanOrEqual(2); // Once in button, once in dropdown
    expect(await screen.findByText('tenant-a')).toBeInTheDocument();
    expect(await screen.findByText('tenant-b')).toBeInTheDocument();
    expect(await screen.findByText('acme-corp')).toBeInTheDocument();
  });
});
