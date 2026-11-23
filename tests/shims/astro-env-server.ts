/** Vitest stand-in for Astro's virtual `astro:env/server` module. */
export function getSecret(name: string): string | undefined {
  return process.env[name];
}
