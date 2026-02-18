import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError, tap } from 'rxjs';
import { Broker, PropertyVersion, Tenant } from '../models/property.model';
import { PropertyApiService } from '../services/property-api.service';
import { extractBackendErrorInfo } from '../utils/http-error.util';
import { validatePropertyDraft } from '../validators/property-validation.util';

interface VersionOption {
  version: string;
  revision: number;
  isHistorical: boolean;
}

@Injectable({ providedIn: 'root' })
export class PropertyStoreService {
  private readonly propertyId = 'property-1';
  private persistedProperty: PropertyVersion | null = null;

  private readonly propertySubject = new BehaviorSubject<PropertyVersion | null>(null);
  private readonly versionsSubject = new BehaviorSubject<VersionOption[]>([]);
  private readonly dirtySubject = new BehaviorSubject<boolean>(false);
  private readonly validationErrorsSubject = new BehaviorSubject<string[]>([]);
  private readonly serverFieldErrorsSubject = new BehaviorSubject<Record<string, string>>({});

  readonly property$: Observable<PropertyVersion | null> = this.propertySubject.asObservable();
  readonly versions$: Observable<VersionOption[]> = this.versionsSubject.asObservable();
  readonly isDirty$: Observable<boolean> = this.dirtySubject.asObservable();
  readonly validationErrors$: Observable<string[]> = this.validationErrorsSubject.asObservable();
  readonly serverFieldErrors$: Observable<Record<string, string>> = this.serverFieldErrorsSubject.asObservable();

  constructor(private readonly api: PropertyApiService) {}

  loadVersion(version = '1.1') {
    return this.api.getVersion(this.propertyId, version).pipe(
      tap((property) => {
        const normalized = this.normalizePropertySnapshot(property);
        this.persistedProperty = structuredClone(normalized);
        this.propertySubject.next(normalized);
        this.validationErrorsSubject.next([]);
        this.serverFieldErrorsSubject.next({});
        this.refreshDirtyState();
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
    this.serverFieldErrorsSubject.next({});
    this.refreshDirtyState();
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

  addBrokerDraft() {
    const broker: Broker = {
      id: this.generateId('temp-broker'),
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

  deleteBroker(brokerId: string): Observable<PropertyVersion> {
    const current = this.propertySubject.value;
    if (!current) {
      return throwError(() => new Error('Property not loaded'));
    }

    if (this.isTempId(brokerId)) {
      this.patchDraft((draft) => ({
        ...draft,
        brokers: draft.brokers.filter((broker) => broker.id !== brokerId),
      }));
      return of(current);
    }

    const broker = current.brokers.find((candidate) => candidate.id === brokerId);
    if (!broker || broker.isDeleted) {
      return throwError(() => new Error('Broker not found'));
    }

    return this.api.softDeleteBroker(this.propertyId, current.version, brokerId, current.revision).pipe(
      tap((saved) => {
        this.persistCollectionUpdate(saved, 'brokers');
      }),
    );
  }

  saveBroker(brokerId: string): Observable<PropertyVersion> {
    const current = this.propertySubject.value;
    if (!current) {
      return throwError(() => new Error('Property not loaded'));
    }

    const broker = current.brokers.find((candidate) => candidate.id === brokerId);
    if (!broker) {
      return throwError(() => new Error('Broker not found in draft'));
    }

    const payload = this.sanitizeBroker(broker);

    if (!payload.name || !payload.phone || !payload.email || !payload.company) {
      return throwError(() => new Error('Broker name, phone, email and company are required'));
    }

    const request$ = this.isTempId(brokerId)
      ? this.api.createBroker(this.propertyId, current.version, current.revision, payload)
      : this.api.updateBroker(this.propertyId, current.version, brokerId, current.revision, payload);

    return request$.pipe(
      tap((saved) => {
        this.persistCollectionUpdate(saved, 'brokers');
      }),
    );
  }

  addTenantDraft() {
    const current = this.propertySubject.value;
    if (!current) {
      return;
    }

    const baseDate = current.underwritingInputs.estStartDate || new Date().toISOString().slice(0, 10);
    const leaseEnd = new Date(baseDate);
    leaseEnd.setFullYear(leaseEnd.getFullYear() + 1);

    const tenant: Tenant = {
      id: this.generateId('temp-tenant'),
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

  addTenant() {
    this.addTenantDraft();
  }

  addBroker() {
    this.addBrokerDraft();
  }

  deleteTenant(tenantId: string): Observable<PropertyVersion> {
    const current = this.propertySubject.value;
    if (!current) {
      return throwError(() => new Error('Property not loaded'));
    }

    if (tenantId === 'vacant-row') {
      return throwError(() => new Error('Vacant row is system-managed and cannot be modified directly'));
    }

    if (this.isTempId(tenantId)) {
      this.patchDraft((draft) => ({
        ...draft,
        tenants: draft.tenants.filter((tenant) => tenant.id !== tenantId),
      }));
      return of(current);
    }

    const tenant = current.tenants.find((candidate) => candidate.id === tenantId);
    if (!tenant || tenant.isDeleted || tenant.isVacant) {
      return throwError(() => new Error('Tenant not found'));
    }

    return this.api.softDeleteTenant(this.propertyId, current.version, tenantId, current.revision).pipe(
      tap((saved) => {
        this.persistCollectionUpdate(saved, 'tenants');
      }),
    );
  }

  updateTenantField<K extends keyof Tenant>(tenantId: string, key: K, value: Tenant[K]) {
    this.patchDraft((draft) => ({
      ...draft,
      tenants: draft.tenants.map((tenant) =>
        tenant.id === tenantId && !tenant.isVacant && !tenant.isDeleted ? { ...tenant, [key]: value } : tenant,
      ),
    }));
  }

  saveTenant(tenantId: string): Observable<PropertyVersion> {
    const current = this.propertySubject.value;
    if (!current) {
      return throwError(() => new Error('Property not loaded'));
    }

    if (tenantId === 'vacant-row') {
      return throwError(() => new Error('Vacant row is system-managed and cannot be modified directly'));
    }

    const tenant = current.tenants.find((candidate) => candidate.id === tenantId);
    if (!tenant) {
      return throwError(() => new Error('Tenant not found in draft'));
    }

    const payload = this.sanitizeTenant(tenant);

    if (!payload.tenantName) {
      return throwError(() => new Error('Tenant name is required'));
    }

    const request$ = this.isTempId(tenantId)
      ? this.api.createTenant(this.propertyId, current.version, current.revision, payload)
      : this.api.updateTenant(this.propertyId, current.version, tenantId, current.revision, payload);

    return request$.pipe(
      tap((saved) => {
        this.persistCollectionUpdate(saved, 'tenants');
      }),
    );
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
      brokers: current.brokers.map((broker) => ({
        id: broker.id,
        name: broker.name,
        phone: broker.phone,
        email: broker.email,
        company: broker.company,
        isDeleted: broker.isDeleted,
      })),
      tenants: current.tenants.map((tenant) => ({
        id: tenant.id,
        tenantName: tenant.tenantName,
        creditType: tenant.creditType,
        squareFeet: tenant.squareFeet,
        rentPsf: tenant.rentPsf,
        annualEscalations: tenant.annualEscalations,
        leaseStart: tenant.leaseStart,
        leaseEnd: tenant.leaseEnd,
        leaseType: tenant.leaseType,
        renew: tenant.renew,
        downtimeMonths: tenant.downtimeMonths,
        tiPsf: tenant.tiPsf,
        lcPsf: tenant.lcPsf,
        isVacant: tenant.isVacant,
        isDeleted: tenant.isDeleted,
      })),
    };

    return this.api.saveVersion(this.propertyId, current.version, payload).pipe(
      tap((saved) => {
        const normalized = this.normalizePropertySnapshot(saved.data);
        this.persistedProperty = structuredClone(normalized);
        this.propertySubject.next(normalized);
        this.validationErrorsSubject.next([]);
        this.serverFieldErrorsSubject.next({});
        this.refreshDirtyState();
        this.loadVersions().subscribe();
      }),
    );
  }

  saveAsNextVersion() {
    const current = this.propertySubject.value;
    if (!current) {
      throw new Error('Property not loaded');
    }

    const payload = {
      expectedRevision: current.revision,
      propertyDetails: current.propertyDetails,
      underwritingInputs: current.underwritingInputs,
      brokers: current.brokers.map((broker) => ({
        id: broker.id,
        name: broker.name,
        phone: broker.phone,
        email: broker.email,
        company: broker.company,
        isDeleted: broker.isDeleted,
      })),
      tenants: current.tenants.map((tenant) => ({
        id: tenant.id,
        tenantName: tenant.tenantName,
        creditType: tenant.creditType,
        squareFeet: tenant.squareFeet,
        rentPsf: tenant.rentPsf,
        annualEscalations: tenant.annualEscalations,
        leaseStart: tenant.leaseStart,
        leaseEnd: tenant.leaseEnd,
        leaseType: tenant.leaseType,
        renew: tenant.renew,
        downtimeMonths: tenant.downtimeMonths,
        tiPsf: tenant.tiPsf,
        lcPsf: tenant.lcPsf,
        isVacant: tenant.isVacant,
        isDeleted: tenant.isDeleted,
      })),
    };

    return this.api.saveAs(this.propertyId, current.version, payload).pipe(
      tap((saved) => {
        const normalized = this.normalizePropertySnapshot(saved.data);
        this.persistedProperty = structuredClone(normalized);
        this.propertySubject.next(normalized);
        this.serverFieldErrorsSubject.next({});
        this.refreshDirtyState();
        this.loadVersions().subscribe();
      }),
    );
  }

  hasUnsavedChanges(): boolean {
    return this.dirtySubject.value;
  }

  getCurrentVersion(): string {
    return this.propertySubject.value?.version ?? '';
  }

  setServerErrors(error: unknown) {
    const parsed = extractBackendErrorInfo(error);
    this.serverFieldErrorsSubject.next(parsed.fieldErrors);
  }

  getServerFieldError(path: string): string | null {
    return this.serverFieldErrorsSubject.value[path] ?? null;
  }

  canAddBrokerOrTenant(): boolean {
    const current = this.propertySubject.value;
    return !!current && !current.isHistorical;
  }

  canSaveBroker(brokerId: string): boolean {
    const current = this.propertySubject.value;
    if (!current || current.isHistorical) {
      return false;
    }

    const broker = current.brokers.find((item) => item.id === brokerId);
    if (!broker || broker.isDeleted) {
      return false;
    }

    const payload = this.sanitizeBroker(broker);
    if (!payload.name || !payload.phone || !payload.email || !payload.company) {
      return false;
    }

    if (this.isTempId(brokerId)) {
      return true;
    }

    const persisted = this.persistedProperty?.brokers.find((item) => item.id === brokerId);
    if (!persisted) {
      return false;
    }

    return JSON.stringify(payload) !== JSON.stringify(this.sanitizeBroker(persisted));
  }

  canDeleteBroker(brokerId: string): boolean {
    const current = this.propertySubject.value;
    if (!current || current.isHistorical) {
      return false;
    }

    const broker = current.brokers.find((item) => item.id === brokerId);
    return !!broker && !broker.isDeleted;
  }

  canSaveTenant(tenantId: string): boolean {
    const current = this.propertySubject.value;
    if (!current || current.isHistorical || tenantId === 'vacant-row') {
      return false;
    }

    const tenant = current.tenants.find((item) => item.id === tenantId);
    if (!tenant || tenant.isDeleted || tenant.isVacant) {
      return false;
    }

    const payload = this.sanitizeTenant(tenant);
    if (!payload.tenantName) {
      return false;
    }

    if (this.isTempId(tenantId)) {
      return true;
    }

    const persisted = this.persistedProperty?.tenants.find((item) => item.id === tenantId);
    if (!persisted) {
      return false;
    }

    return JSON.stringify(payload) !== JSON.stringify(this.sanitizeTenant(persisted));
  }

  canDeleteTenant(tenantId: string): boolean {
    const current = this.propertySubject.value;
    if (!current || current.isHistorical || tenantId === 'vacant-row') {
      return false;
    }

    const tenant = current.tenants.find((item) => item.id === tenantId);
    return !!tenant && !tenant.isDeleted && !tenant.isVacant;
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private isTempId(id: string): boolean {
    return id.startsWith('temp-');
  }

  private sanitizeBroker(broker: Broker): Omit<Broker, 'id' | 'isDeleted'> {
    return {
      name: broker.name?.trim(),
      phone: broker.phone?.trim(),
      email: broker.email?.trim(),
      company: broker.company?.trim(),
    };
  }

  private sanitizeTenant(tenant: Tenant): Omit<Tenant, 'id' | 'isVacant' | 'isDeleted'> {
    return {
      tenantName: tenant.tenantName?.trim(),
      creditType: tenant.creditType,
      squareFeet: tenant.squareFeet,
      rentPsf: tenant.rentPsf,
      annualEscalations: tenant.annualEscalations,
      leaseStart: tenant.leaseStart,
      leaseEnd: tenant.leaseEnd,
      leaseType: tenant.leaseType,
      renew: tenant.renew,
      downtimeMonths: tenant.downtimeMonths,
      tiPsf: tenant.tiPsf,
      lcPsf: tenant.lcPsf,
    };
  }

  private persistCollectionUpdate(saved: PropertyVersion, collection: 'brokers' | 'tenants') {
    const currentDraft = this.propertySubject.value;
    const normalizedSaved = this.normalizePropertySnapshot(saved);
    this.persistedProperty = structuredClone(normalizedSaved);
    if (!currentDraft) {
      this.propertySubject.next(normalizedSaved);
      this.refreshDirtyState();
      return;
    }

    const merged: PropertyVersion = {
      ...normalizedSaved,
      propertyDetails: currentDraft.propertyDetails,
      underwritingInputs: currentDraft.underwritingInputs,
      brokers: collection === 'brokers' ? normalizedSaved.brokers : currentDraft.brokers,
      tenants: collection === 'tenants' ? normalizedSaved.tenants : currentDraft.tenants,
    };

    this.propertySubject.next(merged);
    this.refreshDirtyState();
    this.validationErrorsSubject.next([]);
    this.loadVersions().subscribe();
  }

  private normalizePropertySnapshot(property: PropertyVersion): PropertyVersion {
    return {
      ...property,
      brokers: property.brokers.map((broker) => ({
        id: broker.id,
        name: broker.name,
        phone: broker.phone,
        email: broker.email,
        company: broker.company,
        isDeleted: broker.isDeleted,
      })),
      tenants: property.tenants.map((tenant) => ({
        id: tenant.id,
        tenantName: tenant.tenantName,
        creditType: tenant.creditType,
        squareFeet: tenant.squareFeet,
        rentPsf: tenant.rentPsf,
        annualEscalations: tenant.annualEscalations,
        leaseStart: tenant.leaseStart,
        leaseEnd: tenant.leaseEnd,
        leaseType: tenant.leaseType,
        renew: tenant.renew,
        downtimeMonths: tenant.downtimeMonths,
        tiPsf: tenant.tiPsf,
        lcPsf: tenant.lcPsf,
        isVacant: tenant.isVacant,
        isDeleted: tenant.isDeleted,
      })),
    };
  }

  private refreshDirtyState() {
    const current = this.propertySubject.value;
    const persisted = this.persistedProperty;
    if (!current || !persisted) {
      this.dirtySubject.next(false);
      return;
    }
    this.dirtySubject.next(JSON.stringify(current) !== JSON.stringify(persisted));
  }
}
