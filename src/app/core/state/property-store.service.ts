import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { PropertyVersion } from '../models/property.model';
import { PropertyApiService } from '../services/property-api.service';
import { validatePropertyDraft } from '../validators/property-validation.util';

@Injectable({ providedIn: 'root' })
export class PropertyStoreService {
  private readonly propertyId = 'property-1';

  private readonly propertySubject = new BehaviorSubject<PropertyVersion | null>(null);
  private readonly dirtySubject = new BehaviorSubject<boolean>(false);
  private readonly validationErrorsSubject = new BehaviorSubject<string[]>([]);

  readonly property$: Observable<PropertyVersion | null> = this.propertySubject.asObservable();
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

  patchDraft(mutator: (draft: PropertyVersion) => PropertyVersion) {
    const current = this.propertySubject.value;
    if (!current) {
      return;
    }
    const nextDraft = mutator(structuredClone(current));
    this.propertySubject.next(nextDraft);
    this.dirtySubject.next(true);
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
      }),
    );
  }

  hasUnsavedChanges(): boolean {
    return this.dirtySubject.value;
  }
}
