/**
 * Deployment policy for the SSRF guard applied to user-supplied custom
 * backend URLs. Preset environments are server-trusted configuration and are
 * never routed through this policy. Custom URLs default to denying
 * private/loopback/link-local networks unless the operator explicitly opts in.
 */
export interface SsrfPolicy {
  /** Allow custom URLs that resolve to private/loopback/link-local networks. */
  allowPrivateNetwork: boolean;
}

export function getSsrfPolicy(): SsrfPolicy {
  return {
    allowPrivateNetwork: process.env.WUSOOL_ALLOW_PRIVATE_NETWORK === "1",
  };
}
