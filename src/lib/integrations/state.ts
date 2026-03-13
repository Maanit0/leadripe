/**
 * Parses the OAuth state param which encodes userId and return path.
 * Format: "userId|/return/path" or just "userId" for backward compat.
 */
export function parseOAuthState(state: string): {
  userId: string;
  returnTo: string;
} {
  const pipeIndex = state.indexOf("|");
  if (pipeIndex === -1) {
    return { userId: state, returnTo: "/settings" };
  }
  return {
    userId: state.slice(0, pipeIndex),
    returnTo: state.slice(pipeIndex + 1) || "/settings",
  };
}
