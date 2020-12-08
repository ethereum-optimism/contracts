/**
 * Deployment Helpers
 */

export type DeploymentTarget = 1 | 2 | 3

export interface DeployTargets {
  [target: string]: DeploymentTarget
}

// A bitfield that represents deployment targets.
export const DeployTarget: DeployTargets = {
  L1: 1 as DeploymentTarget,
  L2: (1 << 1) as DeploymentTarget,
  L1L2: ((1 << 1) | 1) as DeploymentTarget,
}

export function shouldDeploy(target: number, remote: number): boolean {
  if (target & remote) {
    return true
  }
  return false
}
