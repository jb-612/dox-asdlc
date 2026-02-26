// ---------------------------------------------------------------------------
// Custom error types for P15-F05 parallel execution engine
// ---------------------------------------------------------------------------

/** Thrown when workflow or container configuration is invalid. */
export class ValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ValidationError';
  }
}

/** Thrown when the port allocator has no available ports remaining. */
export class PortExhaustedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'PortExhaustedError';
  }
}

/** Wraps errors from the Docker client (dockerode). */
export class DockerClientError extends Error {
  constructor(
    msg: string,
    public cause?: Error,
  ) {
    super(msg);
    this.name = 'DockerClientError';
  }
}

/** Thrown when a dormant container cannot be woken (unpaused). */
export class WakeFailedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'WakeFailedError';
  }
}
