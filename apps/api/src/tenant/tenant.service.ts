import { randomUUID } from 'node:crypto';
import type { SignUpInput, StoreSettings } from '@sunha/contracts';

export type TenantRecord = {
  id: string;
  businessName: string;
  country: 'LA';
  createdAt: string;
};

export type StoreRecord = StoreSettings & {
  id: string;
  tenantId: string;
};

export type OwnerRecord = {
  id: string;
  tenantId: string;
  email: string;
};

export type TenantCreation = {
  tenant: TenantRecord;
  store: StoreRecord;
  owner: OwnerRecord;
};

export interface TenantRepository {
  ownerEmailExists(email: string): Promise<boolean>;
  saveTenant(value: TenantRecord): Promise<void>;
  saveStore(value: StoreRecord): Promise<void>;
  saveOwner(value: OwnerRecord): Promise<void>;
}

export class InMemoryTenantRepository implements TenantRepository {
  private readonly owners = new Set<string>();
  readonly tenants: TenantRecord[] = [];
  readonly stores: StoreRecord[] = [];
  readonly ownerRecords: OwnerRecord[] = [];

  ownerEmailExists(email: string): Promise<boolean> {
    return Promise.resolve(this.owners.has(email.trim().toLowerCase()));
  }

  saveTenant(value: TenantRecord): Promise<void> {
    this.tenants.push(value);
    return Promise.resolve();
  }

  saveStore(value: StoreRecord): Promise<void> {
    this.stores.push(value);
    return Promise.resolve();
  }

  saveOwner(value: OwnerRecord): Promise<void> {
    this.owners.add(value.email.trim().toLowerCase());
    this.ownerRecords.push(value);
    return Promise.resolve();
  }
}

export class TenantService {
  constructor(private readonly repository: TenantRepository) {}

  async createTenant(
    input: Pick<SignUpInput, 'email' | 'businessName' | 'country'>,
  ): Promise<TenantCreation> {
    const email = input.email.trim().toLowerCase();
    if (await this.repository.ownerEmailExists(email)) {
      throw new Error('Owner email already exists');
    }

    const now = new Date().toISOString();
    const tenant: TenantRecord = {
      id: randomUUID(),
      businessName: input.businessName.trim(),
      country: input.country,
      createdAt: now,
    };
    const store: StoreRecord = {
      id: randomUUID(),
      tenantId: tenant.id,
      name: input.businessName.trim(),
      address: '',
      phone: '',
      taxNumber: '',
      currency: 'LAK',
      timezone: 'Asia/Vientiane',
      language: 'lo',
    };
    const owner: OwnerRecord = { id: randomUUID(), tenantId: tenant.id, email };

    await this.repository.saveTenant(tenant);
    await this.repository.saveStore(store);
    await this.repository.saveOwner(owner);
    return { tenant, store, owner };
  }
}
