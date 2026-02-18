import { Component, HostListener, OnInit } from '@angular/core';
import { PropertyStoreService } from '../../core/state/property-store.service';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent implements OnInit {
  errorMessage = '';

  constructor(public readonly store: PropertyStoreService) {}

  ngOnInit(): void {
    this.store.loadVersion().subscribe({
      error: (error: unknown) => {
        this.errorMessage = this.extractErrorMessage(error);
      },
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges()) {
      $event.preventDefault();
      $event.returnValue = '';
    }
  }

  onSave() {
    try {
      this.store.saveCurrent().subscribe({
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
      error: (error: unknown) => {
        this.errorMessage = this.extractErrorMessage(error);
      },
    });
  }

  private extractErrorMessage(error: unknown): string {
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
