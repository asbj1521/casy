/**
 * A function secret the code can't work without. A missing one is a
 * deployment mistake, not anything the caller did, so it throws: the function
 * answers with a plain 500 and the log names the secret.
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set for this function.`);
  return value;
}
