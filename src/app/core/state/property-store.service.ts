import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Broker, PropertyVersion, Tenant } from '../models/property.model';
import { PropertyApiService } from '../services/property-api.service';
import { validatePropertyDraft } from '../validators/property-validation.util';

interface VersionOption {
  version: string;
  revision: number;
  isHistorical: boolean;
}

@Injectable({ providedIn: 'root' })
export class PropertyStoreService {
  private readonly propertyId = 'property-1';

  private readonly propertySubject = new BehaviorSubject<PropertyVersion | null>(null);
  private readonly versionsSubject = new BehaviorSubject<VersionOption[]>([]);
  private readonly dirtySubject = new BehaviorSubject<boolean>(false);
  private readonly validationErrorsSubject = new BehaviorSubject<string[]>([]);

  readonly property$: Observable<PropertyVersion | null> = this.propertySubject.asObservable();
  readonly versions$: Observable<VersionOption[]> = this.versionsSubject.asObservable();
  readonly isDirty$: Observable<boolean> = this.dirtySubject.asObservable();
  readonly validationErrors$: Observable<string[]> = this.validationErrorsSubject.asObservable();

  constructor(private readonly api: PropertyApiService) {}

  loadVersion(version = '1.1') {
    return this.api.getVersion(this.propertyId, version).pipe(
      tap((property) => {
        this.propertySubject.next(property);
        this.validationErrorsSubject.next([]);
      }),
    );
  }

  loadVersions() {
    return this.api.getVersions(this.propertyId).pipe(tap((versions) => this.versionsSubject.next(versions)));
  }

  patchDraft(mutator: (draft: PropertyVersion) => PropertyVersion) {
    const current = this.propertySubject.value;
    if (!current) {
      return;
    }
    const nextDraft = mutator(structuredClone(current));
    this.propertySubject.next(nextDraft);
    this.dirtySubject.next(true);
  }

  updatePropertyDetailsField<K extends keyof PropertyVersion['propertyDetails']>(key: K, value: PropertyVersion['propertyDetails'][K]) {
    this.patchDraft((draft) => ({
      ...draft,
      propertyDetails: {
        ...draft.propertyDetails,
        [key]: value,
      },
    }));
  }

  updateUnderwritingField<K extends keyof PropertyVersion['underwritingInputs']>(
    key: K,
    value: PropertyVersion['underwritingInputs'][K],
  ) {
    this.patchDraft((draft) => ({
      ...draft,
      underwritingInputs: {
        ...draft.underwritingInputs,
        [key]: value,
      },
    }));
  }

  addBroker() {
    const broker: Broker = {
      id: this.generateId('broker'),
      name: '',
      phone: '',
      email: '',
      company: '',
      isDeleted: false,
    };

    this.patchDraft((draft) => ({
      ...draft,
      brokers: [...draft.brokers, broker],
    }));
  }

  updateBrokerField(brokerId: string, key: keyof Broker, value: string | boolean) {
    this.patchDraft((draft) => ({
      ...draft,
      brokers: draft.brokers.map((broker) => (broker.id === brokerId ? { ...broker, [key]: value } : broker)),
    }));
  }

  deleteBroker(brokerId: string) {
    this.patchDraft((draft) => ({
      ...draft,
      brokers: draft.brokers.map((broker) =>
        broker.id === brokerId
          ? {
              ...broker,
              isDeleted: true,
            }
          : broker,
      ),
    }));
  }

  addTenant() {
    const current = this.propertySubject.value;
    if (!current) {
      return;
    }

    const baseDate = current.underwritingInputs.estStartDate || new Date().toISOString().slice(0, 10);
    const leaseEnd = new Date(baseDate);
    leaseEnd.setFullYear(leaseEnd.getFullYear() + 1);

    const tenant: Tenant = {
      id: this.generateId('tenant'),
      tenantName: '',
      creditType: 'Local',
      squareFeet: 0,
      rentPsf: 0,
      annualEscalations: 0,
      leaseStart: baseDate,
      leaseEnd: leaseEnd.toISOString().slice(0, 10),
      leaseType: 'Gross',
      renew: 'No',
      downtimeMonths: 0,
      tiPsf: 0,
      lcPsf: 0,
      isVacant: false,
      isDeleted: false,
    };

    this.patchDraft((draft) => ({
      ...draft,
      tenants: [...draft.tenants.filter((row) => !row.isVacant), tenant, ...draft.tenants.filter((row) => row.isVacant)],
    }));
  }

  updateTenantField<K extends keyof Tenant>(tenantId: string, key: K, value: Tenant[K]) {
    this.patchDraft((draft) => ({
      ...draft,
      tenants: draft.tenants.map((tenant) =>
        tenant.id === tenantId && !tenant.isVacant && !tenant.isDeleted ? { ...tenant, [key]: value } : tenant,
      ),
    }));
  }

  deleteTenant(tenantId: string) {
    this.patchDraft((draft) => ({
      ...draft,
      tenants: draft.tenants.map((tenant) =>
        tenant.id === tenantId && !tenant.isVacant
          ? {
              ...tenant,
              isDeleted: true,
            }
          : tenant,
      ),
    }));
  }

  saveCurrent() {
    const current = this.propertySubject.value;
    if (!current) {
      throw new Error('Property not loaded');
    }

    const validationErrors = validatePropertyDraft(current);
    this.validationErrorsSubject.next(validationErrors);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(' | '));
    }

    const payload = {
      expectedRevision: current.revision,
      propertyDetails: current.propertyDetails,
      underwritingInputs: current.underwritingInputs,
      brokers: current.brokers,
      tenants: current.tenants,
    };

    return this.api.saveVersion(this.propertyId, current.version, payload).pipe(
      tap((saved) => {
        this.propertySubject.next(saved);
        this.dirtySubject.next(false);
        this.validationErrorsSubject.next([]);
        this.loadVersions().subscribe();
      }),
    );
  }

  saveAsNextVersion() {
    const current = this.propertySubject.value;
    if (!current) {
      throw new Error('Property not loaded');
    }

    return this.api.saveAs(this.propertyId, current.version, current.revision).pipe(
      tap((saved) => {
        this.propertySubject.next(saved);
        this.dirtySubject.next(false);
        this.loadVersions().subscribe();
      }),
    );
  }

  hasUnsavedChanges(): boolean {
    return this.dirtySubject.value;
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
