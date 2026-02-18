import { Broker, PropertyVersion, Tenant } from '../models/property.model';

const VACANT_TENANT_ID = 'vacant-row';

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function ensureBrokerValid(broker: Broker, index: number, errors: string[]) {
  if (!broker.id) {
    errors.push(`Broker ${index + 1}: missing id`);
  }
  if (!broker.name.trim()) {
    errors.push(`Broker ${index + 1}: name is required`);
  }
  if (!broker.phone.trim()) {
    errors.push(`Broker ${index + 1}: phone is required`);
  }
  if (!broker.company.trim()) {
    errors.push(`Broker ${index + 1}: company is required`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(broker.email)) {
    errors.push(`Broker ${index + 1}: invalid email`);
  }
}

function ensureTenantValid(tenant: Tenant, index: number, errors: string[]) {
  if (!tenant.id) {
    errors.push(`Tenant ${index + 1}: missing id`);
  }
  if (!tenant.tenantName.trim()) {
    errors.push(`Tenant ${index + 1}: tenantName is required`);
  }
  if (tenant.squareFeet < 0) {
    errors.push(`Tenant ${index + 1}: squareFeet must be >= 0`);
  }
  if (tenant.rentPsf < 0 || tenant.annualEscalations < 0 || tenant.tiPsf < 0 || tenant.lcPsf < 0) {
    errors.push(`Tenant ${index + 1}: monetary fields must be >= 0`);
  }
  if (tenant.downtimeMonths < 0) {
    errors.push(`Tenant ${index + 1}: downtimeMonths must be >= 0`);
  }
  if (!isValidDate(tenant.leaseStart) || !isValidDate(tenant.leaseEnd)) {
    errors.push(`Tenant ${index + 1}: leaseStart/leaseEnd must be valid dates`);
  }
}

export function validatePropertyDraft(draft: PropertyVersion): string[] {
  const errors: string[] = [];

  if (!draft.propertyDetails.address.trim()) {
    errors.push('Property address is required');
  }
  if (draft.propertyDetails.buildingSizeSf <= 0) {
    errors.push('Building size must be greater than 0');
  }
  if (!isValidDate(draft.underwritingInputs.estStartDate)) {
    errors.push('Underwriting start date is invalid');
  }
  if (draft.underwritingInputs.holdPeriodYears <= 0) {
    errors.push('Hold period years must be greater than 0');
  }

  const brokerIds = draft.brokers.map((broker) => broker.id);
  if (new Set(brokerIds).size !== brokerIds.length) {
    errors.push('Broker IDs must be unique');
  }
  draft.brokers.forEach((broker, index) => ensureBrokerValid(broker, index, errors));

  const activeTenants = draft.tenants.filter((tenant) => !tenant.isVacant);
  const tenantIds = activeTenants.map((tenant) => tenant.id);
  if (new Set(tenantIds).size !== tenantIds.length) {
    errors.push('Tenant IDs must be unique for non-vacant rows');
  }

  const badVacantRows = draft.tenants.filter((tenant) => tenant.id === VACANT_TENANT_ID && !tenant.isVacant);
  if (badVacantRows.length > 0) {
    errors.push('Vacant row is system-managed and cannot be modified directly');
  }

  activeTenants.forEach((tenant, index) => ensureTenantValid(tenant, index, errors));

  const totalSqFt = activeTenants.filter((tenant) => !tenant.isDeleted).reduce((acc, tenant) => acc + tenant.squareFeet, 0);
  if (totalSqFt > draft.propertyDetails.buildingSizeSf) {
    errors.push('Total tenant square footage must be <= property space');
  }

  for (const tenant of activeTenants.filter((candidate) => !candidate.isDeleted)) {
    const leaseStart = new Date(tenant.leaseStart);
    const leaseEnd = new Date(tenant.leaseEnd);
    const propertyStart = new Date(draft.underwritingInputs.estStartDate);
    const maxLeaseEnd = new Date(leaseStart);
    maxLeaseEnd.setFullYear(maxLeaseEnd.getFullYear() + draft.underwritingInputs.holdPeriodYears);

    if (leaseStart < propertyStart) {
      errors.push(`Tenant ${tenant.tenantName}: lease start cannot be before property start`);
    }
    if (leaseEnd > maxLeaseEnd) {
      errors.push(`Tenant ${tenant.tenantName}: lease end cannot exceed start + hold period`);
    }
  }

  return errors;
}
