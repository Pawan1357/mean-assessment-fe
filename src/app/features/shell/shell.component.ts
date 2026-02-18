import { Component, HostListener, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap } from 'rxjs';
import { PropertyStoreService } from '../../core/state/property-store.service';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent implements OnInit {
  errorMessage = '';
  validationErrors: string[] = [];

  constructor(public readonly store: PropertyStoreService) {}

  ngOnInit(): void {
    this.store
      .loadVersions()
      .pipe(
        switchMap((versions) => {
          const selected = versions.find((item) => !item.isHistorical)?.version ?? versions[0]?.version ?? '1.1';
          return this.store.loadVersion(selected);
        }),
      )
      .subscribe({
      error: (error: unknown) => {
        this.errorMessage = this.extractErrorMessage(error);
      },
    });

    this.store.validationErrors$.subscribe((errors) => {
      this.validationErrors = errors;
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges()) {
      $event.preventDefault();
      $event.returnValue = '';
    }
  }

  onVersionChange(version: string) {
    if (!version) {
      return;
    }

    if (this.store.hasUnsavedChanges() && !window.confirm('You have unsaved changes. Switch version anyway?')) {
      return;
    }

    this.store.loadVersion(version).subscribe({
      error: (error: unknown) => {
        this.errorMessage = this.extractErrorMessage(error);
      },
    });
  }

  onSave() {
    try {
      this.store.saveCurrent().subscribe({
        next: () => {
          this.errorMessage = '';
        },
        error: (error: unknown) => {
          this.errorMessage = this.extractErrorMessage(error);
        },
      });
    } catch (error) {
      this.errorMessage = this.extractErrorMessage(error);
    }
  }

  onSaveAs() {
    this.store.saveAsNextVersion().subscribe({
      next: () => {
        this.errorMessage = '';
      },
      error: (error: unknown) => {
        this.errorMessage = this.extractErrorMessage(error);
      },
    });
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage =
        typeof error.error === 'object' && error.error !== null && 'message' in error.error
          ? String((error.error as { message: unknown }).message)
          : '';

      if (backendMessage) {
        return backendMessage;
      }
      return error.message || `HTTP ${error.status}`;
    }

    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const httpError = error as { error?: { message?: string } };
      if (httpError.error?.message) {
        return httpError.error.message;
      }
    }
    return 'An unexpected error occurred';
  }
}
