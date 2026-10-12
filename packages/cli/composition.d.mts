export function installationOrder<
  T extends { slug: string; components?: string[] },
>(requested: string[], catalogue: T[]): T[];
