import { Component } from '@angular/core';
import { Broker, PropertyDetails } from '../../core/models/property.model';
import { PropertyStoreService } from '../../core/state/property-store.service';

@Component({
  selector: 'app-property-details',
  templateUrl: './property-details.component.html',
  styleUrls: ['./property-details.component.css'],
})
export class PropertyDetailsComponent {
  actionError = '';

  readonly leftInfoFields: Array<{ label: string; key: keyof PropertyDetails }> = [
    { label: 'Market', key: 'market' },
    { label: 'Sub Market', key: 'subMarket' },
    { label: 'Property Type', key: 'propertyType' },
    { label: 'Property Sub Type', key: 'propertySubType' },
    { label: 'Zoning', key: 'zoning' },
    { label: 'Zoning Details', key: 'zoningDetails' },
    { label: 'Listing Type', key: 'listingType' },
    { label: 'Business Plan', key: 'businessPlan' },
    { label: 'Seller Type', key: 'sellerType' },
    { label: 'Last Trade Date', key: 'lastTradeDate' },
  ];

  readonly listingFields: Array<{ label: string; key: keyof PropertyDetails }> = [
    { label: 'Asking Price', key: 'askingPrice' },
    { label: 'Bid Amount', key: 'bidAmount' },
    { label: 'Year 1 Cap Rate', key: 'yearOneCapRate' },
    { label: 'Stabilized Cap Rate', key: 'stabilizedCapRate' },
  ];

  readonly specsFields: Array<{ label: string; key: keyof PropertyDetails }> = [
    { label: 'Vintage', key: 'vintage' },
    { label: 'Building Size (SF)', key: 'buildingSizeSf' },
    { label: 'Warehouse (SF)', key: 'warehouseSf' },
    { label: 'Office (SF)', key: 'officeSf' },
    { label: 'Property Size (Acres)', key: 'propertySizeAcres' },
    { label: 'Coverage Ratio', key: 'coverageRatio' },
    { label: 'Outdoor Storage', key: 'outdoorStorage' },
    { label: 'Construction Type', key: 'constructionType' },
    { label: 'Clear Height (Ft)', key: 'clearHeightFt' },
    { label: 'Dock Doors', key: 'dockDoors' },
    { label: 'Drive-In Doors', key: 'driveInDoors' },
    { label: 'Heavy Power', key: 'heavyPower' },
    { label: 'Sprinkler Type', key: 'sprinklerType' },
  ];

  constructor(public readonly store: PropertyStoreService) {}

  onAddBroker() {
    this.actionError = '';
    this.store.addBrokerDraft();
  }

  onDeleteBroker(brokerId: string) {
    this.actionError = '';
    this.store.deleteBroker(brokerId).subscribe({
      error: (error: unknown) => {
        this.actionError = error instanceof Error ? error.message : 'Failed to delete broker';
      },
    });
  }

  onSaveBroker(brokerId: string) {
    this.actionError = '';
    this.store.saveBroker(brokerId).subscribe({
      error: (error: unknown) => {
        this.actionError = error instanceof Error ? error.message : 'Failed to save broker';
      },
    });
  }

  onBrokerFieldChange(broker: Broker, key: keyof Broker, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.store.updateBrokerField(broker.id, key, value);
  }

  onDetailFieldChange(key: keyof PropertyDetails, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const numericKeys = new Set<keyof PropertyDetails>([
      'lastTradePrice',
      'askingPrice',
      'bidAmount',
      'yearOneCapRate',
      'stabilizedCapRate',
      'vintage',
      'buildingSizeSf',
      'warehouseSf',
      'officeSf',
      'propertySizeAcres',
      'coverageRatio',
      'clearHeightFt',
      'dockDoors',
      'driveInDoors',
    ]);

    if (numericKeys.has(key)) {
      this.store.updatePropertyDetailsField(key, Number(value || 0) as PropertyDetails[typeof key]);
      return;
    }

    this.store.updatePropertyDetailsField(key, value as PropertyDetails[typeof key]);
  }
}
