import { Injectable, signal } from '@angular/core';

export interface RuntimeConfig { apiBaseUrl: string; }

export function mapApiBaseUrl(value: unknown): string {
  if (!value || typeof value !== 'object' || !('apiBaseUrl' in value)) throw new Error('Runtime config non valida');
  const url = String((value as RuntimeConfig).apiBaseUrl).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(url)) throw new Error('apiBaseUrl non valida');
  return url;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  readonly error = signal<string | null>(null);
  private apiUrl = '';

  async load(): Promise<void> {
    try {
      const configUrl = new URL('runtime-config.json', document.baseURI).toString();
      const response = await fetch(configUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.apiUrl = mapApiBaseUrl(await response.json());
    } catch (error) {
      console.error('Runtime config error', error);
      this.error.set('Configurazione API non disponibile. Riprova più tardi.');
    }
  }

  get apiBaseUrl(): string {
    if (!this.apiUrl) throw new Error('Runtime config non caricata');
    return this.apiUrl;
  }
}
