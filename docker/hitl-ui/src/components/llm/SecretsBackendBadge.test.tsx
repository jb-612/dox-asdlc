/**
 * Tests for SecretsBackendBadge Component (P09-F01 T08)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SecretsBackendBadge from './SecretsBackendBadge';
import type { SecretsHealthResponse } from '../../types/llmConfig';

describe('SecretsBackendBadge', () => {
  describe('loading state', () => {
    it('renders loading spinner when isLoading is true', () => {
      render(<SecretsBackendBadge isLoading={true} />);

      expect(screen.getByTestId('secrets-backend-badge-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading secrets backend...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error message when error is provided', () => {
      render(<SecretsBackendBadge error="Connection failed" />);

      expect(screen.getByTestId('secrets-backend-badge-error')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    it('renders default error when health is null', () => {
      render(<SecretsBackendBadge health={null} />);

      expect(screen.getByTestId('secrets-backend-badge-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to check secrets backend')).toBeInTheDocument();
    });
  });

  describe('healthy env backend', () => {
    it('renders env backend with healthy status', () => {
      const health: SecretsHealthResponse = {
        status: 'healthy',
        backend: 'env',
        details: { source: 'environment variables' },
      };

      render(<SecretsBackendBadge health={health} />);

      expect(screen.getByTestId('secrets-backend-badge')).toBeInTheDocument();
      expect(screen.getByText('Environment Variables')).toBeInTheDocument();
      expect(screen.getByText('healthy')).toBeInTheDocument();
    });
  });

  describe('healthy infisical backend', () => {
    it('renders infisical backend with healthy status', () => {
      const health: SecretsHealthResponse = {
        status: 'healthy',
        backend: 'infisical',
        details: { connected: true, version: '0.78.0' },
      };

      render(<SecretsBackendBadge health={health} />);

      expect(screen.getByTestId('secrets-backend-badge')).toBeInTheDocument();
      expect(screen.getByText('Infisical')).toBeInTheDocument();
      expect(screen.getByText('healthy')).toBeInTheDocument();
    });
  });

  describe('healthy gcp backend', () => {
    it('renders gcp backend with healthy status', () => {
      const health: SecretsHealthResponse = {
        status: 'healthy',
        backend: 'gcp',
        details: { project: 'my-project' },
      };

      render(<SecretsBackendBadge health={health} />);

      expect(screen.getByTestId('secrets-backend-badge')).toBeInTheDocument();
      expect(screen.getByText('GCP Secret Manager')).toBeInTheDocument();
      expect(screen.getByText('healthy')).toBeInTheDocument();
    });
  });

  describe('degraded status', () => {
    it('renders degraded status with warning styling', () => {
      const health: SecretsHealthResponse = {
        status: 'degraded',
        backend: 'gcp',
        details: { quota_warning: true },
      };

      render(<SecretsBackendBadge health={health} />);

      expect(screen.getByText('degraded')).toBeInTheDocument();
    });
  });

  describe('unhealthy status', () => {
    it('renders unhealthy status', () => {
      const health: SecretsHealthResponse = {
        status: 'unhealthy',
        backend: 'infisical',
        error: 'Connection refused',
      };

      render(<SecretsBackendBadge health={health} />);

      expect(screen.getByText('unhealthy')).toBeInTheDocument();
    });
  });
});
