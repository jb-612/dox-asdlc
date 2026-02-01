/**
 * Tests for TestResultDialog Component (P09-F01 T09)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestResultDialog from './TestResultDialog';
import type { EnhancedTestIntegrationCredentialResponse } from '../../types/llmConfig';

describe('TestResultDialog', () => {
  describe('when closed', () => {
    it('does not render when isOpen is false', () => {
      const onClose = vi.fn();
      const result: EnhancedTestIntegrationCredentialResponse = {
        valid: true,
        message: 'Test passed',
        testedAt: new Date().toISOString(),
      };

      render(
        <TestResultDialog
          isOpen={false}
          onClose={onClose}
          result={result}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not render when result is null', () => {
      const onClose = vi.fn();

      render(
        <TestResultDialog
          isOpen={true}
          onClose={onClose}
          result={null}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('successful test result', () => {
    it('renders success state', () => {
      const onClose = vi.fn();
      const result: EnhancedTestIntegrationCredentialResponse = {
        valid: true,
        message: 'Token is valid',
        testedAt: new Date().toISOString(),
      };

      render(
        <TestResultDialog
          isOpen={true}
          onClose={onClose}
          result={result}
          credentialName="Test Credential"
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Successful')).toBeInTheDocument();
      expect(screen.getByText('Token is valid')).toBeInTheDocument();
      expect(screen.getByText('Test Credential')).toBeInTheDocument();
    });
  });

  describe('failed test result', () => {
    it('renders failure state', () => {
      const onClose = vi.fn();
      const result: EnhancedTestIntegrationCredentialResponse = {
        valid: false,
        message: 'Authentication failed',
        testedAt: new Date().toISOString(),
      };

      render(
        <TestResultDialog
          isOpen={true}
          onClose={onClose}
          result={result}
        />
      );

      expect(screen.getByText('Test Failed')).toBeInTheDocument();
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    });
  });

  describe('Slack bot token with enhanced details', () => {
    it('renders Slack-specific details', () => {
      const onClose = vi.fn();
      const result: EnhancedTestIntegrationCredentialResponse = {
        valid: true,
        message: 'Token is valid. Test message sent to #asdlc-notifications',
        testedAt: new Date().toISOString(),
        details: {
          team: 'TestTeam',
          team_id: 'T12345',
          channel: '#asdlc-notifications',
          timestamp: '1706820000.123456',
        },
      };

      render(
        <TestResultDialog
          isOpen={true}
          onClose={onClose}
          result={result}
          credentialName="Production Slack Bot"
          integrationType="slack"
        />
      );

      expect(screen.getByText('Test message sent successfully')).toBeInTheDocument();
      expect(screen.getByText('TestTeam')).toBeInTheDocument();
      expect(screen.getByText('#asdlc-notifications')).toBeInTheDocument();
      expect(screen.getByText('1706820000.123456')).toBeInTheDocument();
    });
  });

  describe('GitHub token with details', () => {
    it('renders GitHub-specific details', () => {
      const onClose = vi.fn();
      const result: EnhancedTestIntegrationCredentialResponse = {
        valid: true,
        message: 'Valid token for user: testuser',
        testedAt: new Date().toISOString(),
        details: {
          login: 'testuser',
          name: 'Test User',
        },
      };

      render(
        <TestResultDialog
          isOpen={true}
          onClose={onClose}
          result={result}
          credentialName="GitHub PAT"
          integrationType="github"
        />
      );

      expect(screen.getByText('@testuser')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const result: EnhancedTestIntegrationCredentialResponse = {
        valid: true,
        message: 'Test passed',
        testedAt: new Date().toISOString(),
      };

      render(
        <TestResultDialog
          isOpen={true}
          onClose={onClose}
          result={result}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /close/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
