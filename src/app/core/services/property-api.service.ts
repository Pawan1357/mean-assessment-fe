import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiSuccessResponse } from '../models/api-response.model';
import { PropertyVersion } from '../models/property.model';

@Injectable({ providedIn: 'root' })
export class PropertyApiService {
  private readonly baseUrl = '/api/properties';

  constructor(private readonly http: HttpClient) {}

  getVersions(propertyId: string): Observable<Array<{ version: string; revision: number; isHistorical: boolean }>> {
    return this.http
      .get<ApiSuccessResponse<Array<{ version: string; revision: number; isHistorical: boolean }>>>(
        `${this.baseUrl}/${propertyId}/versions`,
      )
      .pipe(map((response) => response.data));
  }

  getVersion(propertyId: string, version: string): Observable<PropertyVersion> {
    return this.http
      .get<ApiSuccessResponse<PropertyVersion>>(`${this.baseUrl}/${propertyId}/versions/${version}`)
      .pipe(map((response) => response.data));
  }

  saveVersion(propertyId: string, version: string, payload: unknown): Observable<PropertyVersion> {
    return this.http
      .put<ApiSuccessResponse<PropertyVersion>>(`${this.baseUrl}/${propertyId}/versions/${version}`, payload)
      .pipe(map((response) => response.data));
  }

  saveAs(propertyId: string, version: string, expectedRevision: number): Observable<PropertyVersion> {
    return this.http
      .post<ApiSuccessResponse<PropertyVersion>>(`${this.baseUrl}/${propertyId}/versions/${version}/save-as`, { expectedRevision })
      .pipe(map((response) => response.data));
  }
}
