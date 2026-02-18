import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { PropertyStoreService } from '../../core/state/property-store.service';

@Component({
  selector: 'app-property-details',
  templateUrl: './property-details.component.html',
  styleUrls: ['./property-details.component.css'],
})
export class PropertyDetailsComponent {
  readonly form;

  constructor(
    private readonly fb: FormBuilder,
    public readonly store: PropertyStoreService,
  ) {
    this.form = this.fb.group({
      market: ['', Validators.required],
      subMarket: ['', Validators.required],
      propertyType: ['', Validators.required],
      buildingSizeSf: [0, [Validators.required, Validators.min(1)]],
    });

    this.store.property$.subscribe((property) => {
      if (!property) {
        return;
      }

      this.form.patchValue({
        market: property.propertyDetails.market,
        subMarket: property.propertyDetails.subMarket,
        propertyType: property.propertyDetails.propertyType,
        buildingSizeSf: property.propertyDetails.buildingSizeSf,
      }, { emitEvent: false });
    });

    this.form.valueChanges.subscribe((value) => {
      this.store.patchDraft((draft) => ({
        ...draft,
        propertyDetails: {
          ...draft.propertyDetails,
          market: value.market ?? draft.propertyDetails.market,
          subMarket: value.subMarket ?? draft.propertyDetails.subMarket,
          propertyType: value.propertyType ?? draft.propertyDetails.propertyType,
          buildingSizeSf: value.buildingSizeSf ?? draft.propertyDetails.buildingSizeSf,
        },
      }));
    });
  }
}
