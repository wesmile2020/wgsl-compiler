export function shouldOutput(ifStack: boolean[]): boolean {
  if (ifStack.length === 0) {
    return true;
  }
  for (let i = 0; i < ifStack.length; i += 1) {
    if (!ifStack[i]) {
      return false;
    }
  }
  return true;
}
