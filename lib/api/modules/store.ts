import 'server-only';
import type { z } from 'zod';
import { publicProductSchema } from '../catalog-contracts';
import { SuburbioApiClient } from '../client';
export interface StoreCatalog { listProducts(): Promise<z.infer<typeof publicProductSchema>[]> }
export class StoreService implements StoreCatalog {
  constructor(private client = new SuburbioApiClient()) {}
  async listProducts() { return (await this.client.catalog()).data.products; }
}
