export enum ProviderName {
  FORNO = 'FORNO',
  ALCHEMY = 'ALCHEMY',
  NIRVANA = 'NIRVANA',
  UNKNOWN = 'UNKNOWN',
}

export function deriveProviderName(url: string): ProviderName {
  for (const name in ProviderName) {
    if (url.toUpperCase().includes(name)) {
      return ProviderName[name as keyof typeof ProviderName]
    }
  }

  return ProviderName.UNKNOWN
}
