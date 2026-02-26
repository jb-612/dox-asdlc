// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dockerode
// ---------------------------------------------------------------------------

const mockPull = vi.fn();
const mockCreateContainer = vi.fn();
const mockListContainers = vi.fn();

const mockContainerStart = vi.fn();
const mockContainerPause = vi.fn();
const mockContainerUnpause = vi.fn();
const mockContainerStop = vi.fn();
const mockContainerRemove = vi.fn();

const mockGetContainer = vi.fn().mockReturnValue({
  start: mockContainerStart,
  pause: mockContainerPause,
  unpause: mockContainerUnpause,
  stop: mockContainerStop,
  remove: mockContainerRemove,
});

vi.mock('dockerode', () => {
  return {
    default: class MockDocker {
      pull = mockPull;
      createContainer = mockCreateContainer;
      listContainers = mockListContainers;
      getContainer = mockGetContainer;
    },
  };
});

// Mock global fetch for healthCheck
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { DockerClient } from '../../src/main/services/docker-client';
import { DockerClientError } from '../../src/shared/types/errors';

describe('DockerClient', () => {
  let client: DockerClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DockerClient();
  });

  // -----------------------------------------------------------------------
  // pullImage
  // -----------------------------------------------------------------------

  describe('pullImage', () => {
    it('calls docker.pull with image name and resolves on finish', async () => {
      const mockStream = {
        on: vi.fn((event: string, cb: () => void) => {
          if (event === 'end') cb();
          return mockStream;
        }),
      };
      mockPull.mockImplementation((_image: string, cb: (err: null, stream: typeof mockStream) => void) => {
        cb(null, mockStream);
      });

      await client.pullImage('node:20-alpine');
      expect(mockPull).toHaveBeenCalledWith('node:20-alpine', expect.any(Function));
    });

    it('wraps pull errors in DockerClientError', async () => {
      mockPull.mockImplementation((_image: string, cb: (err: Error) => void) => {
        cb(new Error('pull failed'));
      });

      await expect(client.pullImage('bad:image')).rejects.toThrow(DockerClientError);
      await expect(client.pullImage('bad:image')).rejects.toThrow(/pull.*bad:image/i);
    });
  });

  // -----------------------------------------------------------------------
  // createContainer
  // -----------------------------------------------------------------------

  describe('createContainer', () => {
    it('creates container with ExtraHosts for host.docker.internal', async () => {
      const mockContainerObj = { id: 'abc123' };
      mockCreateContainer.mockResolvedValue(mockContainerObj);

      const result = await client.createContainer({
        Image: 'node:20-alpine',
        HostConfig: {
          PortBindings: { '3000/tcp': [{ HostPort: '49200' }] },
        },
      });

      expect(result).toEqual(mockContainerObj);
      expect(mockCreateContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'node:20-alpine',
          HostConfig: expect.objectContaining({
            ExtraHosts: ['host.docker.internal:host-gateway'],
            PortBindings: { '3000/tcp': [{ HostPort: '49200' }] },
          }),
        }),
      );
    });

    it('preserves existing ExtraHosts entries', async () => {
      mockCreateContainer.mockResolvedValue({ id: 'def456' });

      await client.createContainer({
        Image: 'node:20-alpine',
        HostConfig: {
          ExtraHosts: ['myhost:1.2.3.4'],
        },
      });

      const call = mockCreateContainer.mock.calls[0][0];
      expect(call.HostConfig.ExtraHosts).toContain('host.docker.internal:host-gateway');
      expect(call.HostConfig.ExtraHosts).toContain('myhost:1.2.3.4');
    });

    it('adds asdlc.managed=true label automatically (T24)', async () => {
      mockCreateContainer.mockResolvedValue({ id: 'abc123' });

      await client.createContainer({
        Image: 'node:20-alpine',
      });

      const call = mockCreateContainer.mock.calls[0][0];
      expect(call.Labels).toEqual(expect.objectContaining({ 'asdlc.managed': 'true' }));
    });

    it('preserves existing labels when adding asdlc.managed (T24)', async () => {
      mockCreateContainer.mockResolvedValue({ id: 'abc123' });

      await client.createContainer({
        Image: 'node:20-alpine',
        Labels: { 'app.name': 'test' },
      });

      const call = mockCreateContainer.mock.calls[0][0];
      expect(call.Labels['asdlc.managed']).toBe('true');
      expect(call.Labels['app.name']).toBe('test');
    });

    it('wraps errors in DockerClientError', async () => {
      mockCreateContainer.mockRejectedValue(new Error('create fail'));

      await expect(
        client.createContainer({ Image: 'x' }),
      ).rejects.toThrow(DockerClientError);
    });
  });

  // -----------------------------------------------------------------------
  // startContainer
  // -----------------------------------------------------------------------

  describe('startContainer', () => {
    it('starts the container by ID', async () => {
      mockContainerStart.mockResolvedValue(undefined);

      await client.startContainer('abc123');

      expect(mockGetContainer).toHaveBeenCalledWith('abc123');
      expect(mockContainerStart).toHaveBeenCalled();
    });

    it('wraps errors in DockerClientError', async () => {
      mockContainerStart.mockRejectedValue(new Error('start fail'));

      await expect(client.startContainer('abc123')).rejects.toThrow(DockerClientError);
    });
  });

  // -----------------------------------------------------------------------
  // pauseContainer
  // -----------------------------------------------------------------------

  describe('pauseContainer', () => {
    it('pauses the container by ID', async () => {
      mockContainerPause.mockResolvedValue(undefined);

      await client.pauseContainer('abc123');

      expect(mockGetContainer).toHaveBeenCalledWith('abc123');
      expect(mockContainerPause).toHaveBeenCalled();
    });

    it('wraps errors in DockerClientError', async () => {
      mockContainerPause.mockRejectedValue(new Error('pause fail'));

      await expect(client.pauseContainer('abc123')).rejects.toThrow(DockerClientError);
    });
  });

  // -----------------------------------------------------------------------
  // unpauseContainer
  // -----------------------------------------------------------------------

  describe('unpauseContainer', () => {
    it('unpauses the container by ID', async () => {
      mockContainerUnpause.mockResolvedValue(undefined);

      await client.unpauseContainer('abc123');

      expect(mockGetContainer).toHaveBeenCalledWith('abc123');
      expect(mockContainerUnpause).toHaveBeenCalled();
    });

    it('wraps errors in DockerClientError', async () => {
      mockContainerUnpause.mockRejectedValue(new Error('unpause fail'));

      await expect(client.unpauseContainer('abc123')).rejects.toThrow(DockerClientError);
    });
  });

  // -----------------------------------------------------------------------
  // stopContainer
  // -----------------------------------------------------------------------

  describe('stopContainer', () => {
    it('stops the container by ID', async () => {
      mockContainerStop.mockResolvedValue(undefined);

      await client.stopContainer('abc123');

      expect(mockGetContainer).toHaveBeenCalledWith('abc123');
      expect(mockContainerStop).toHaveBeenCalled();
    });

    it('wraps errors in DockerClientError', async () => {
      mockContainerStop.mockRejectedValue(new Error('stop fail'));

      await expect(client.stopContainer('abc123')).rejects.toThrow(DockerClientError);
    });
  });

  // -----------------------------------------------------------------------
  // removeContainer
  // -----------------------------------------------------------------------

  describe('removeContainer', () => {
    it('removes the container by ID with force', async () => {
      mockContainerRemove.mockResolvedValue(undefined);

      await client.removeContainer('abc123');

      expect(mockGetContainer).toHaveBeenCalledWith('abc123');
      expect(mockContainerRemove).toHaveBeenCalledWith({ force: true });
    });

    it('wraps errors in DockerClientError', async () => {
      mockContainerRemove.mockRejectedValue(new Error('remove fail'));

      await expect(client.removeContainer('abc123')).rejects.toThrow(DockerClientError);
    });
  });

  // -----------------------------------------------------------------------
  // listContainers
  // -----------------------------------------------------------------------

  describe('listContainers', () => {
    it('lists containers with optional filters', async () => {
      const mockContainerList = [{ Id: 'abc' }];
      mockListContainers.mockResolvedValue(mockContainerList);

      const result = await client.listContainers({ label: ['asdlc=true'] });

      expect(mockListContainers).toHaveBeenCalledWith({
        filters: { label: ['asdlc=true'] },
      });
      expect(result).toEqual(mockContainerList);
    });

    it('lists all containers when no filters provided', async () => {
      mockListContainers.mockResolvedValue([]);

      const result = await client.listContainers();

      expect(mockListContainers).toHaveBeenCalledWith({ filters: {} });
      expect(result).toEqual([]);
    });

    it('wraps errors in DockerClientError', async () => {
      mockListContainers.mockRejectedValue(new Error('list fail'));

      await expect(client.listContainers()).rejects.toThrow(DockerClientError);
    });
  });

  // -----------------------------------------------------------------------
  // healthCheck
  // -----------------------------------------------------------------------

  describe('healthCheck', () => {
    it('resolves when health endpoint returns ok on first try', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.healthCheck(49200, 100, 5000);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:49200/health');
    });

    it('retries until health endpoint succeeds', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({ ok: true });

      await client.healthCheck(49200, 50, 5000);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws DockerClientError when timeout exceeded', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        client.healthCheck(49200, 50, 200),
      ).rejects.toThrow(DockerClientError);

      await expect(
        client.healthCheck(49200, 50, 200),
      ).rejects.toThrow(/health.*check.*timeout/i);
    });
  });
});
