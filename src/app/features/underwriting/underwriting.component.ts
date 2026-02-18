import { Component } from '@angular/core';
import { PropertyStoreService } from '../../core/state/property-store.service';

@Component({
  selector: 'app-underwriting',
  templateUrl: './underwriting.component.html',
  styleUrls: ['./underwriting.component.css'],
})
export class UnderwritingComponent {
  constructor(public readonly store: PropertyStoreService) {}

  onSquareFeetChange(tenantId: string, value: number) {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    this.store.patchDraft((draft) => ({
      ...draft,
      tenants: draft.tenants.map((tenant) =>
        tenant.id === tenantId && !tenant.isVacant && !tenant.isDeleted ? { ...tenant, squareFeet: value } : tenant,
      ),
    }));
  }
}
