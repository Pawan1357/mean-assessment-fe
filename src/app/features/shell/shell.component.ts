import { Component, HostListener, OnInit } from '@angular/core';
import { switchMap } from 'rxjs';
import { PropertyStoreService } from '../../core/state/property-store.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent implements OnInit {
  errorMessage = '';
  successMessage = '';
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
        this.store.setServerErrors(error);
        this.errorMessage = extractErrorMessage(error);
        this.successMessage = '';
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
      next: () => {
        this.errorMessage = '';
        this.successMessage = '';
      },
      error: (error: unknown) => {
        this.store.setServerErrors(error);
        this.errorMessage = extractErrorMessage(error);
        this.successMessage = '';
      },
    });
  }

  onSave() {
    try {
      this.store.saveCurrent().subscribe({
        next: (result) => {
          this.errorMessage = '';
          this.successMessage = result.message;
        },
        error: (error: unknown) => {
          this.store.setServerErrors(error);
          this.errorMessage = extractErrorMessage(error);
          this.successMessage = '';
        },
      });
    } catch (error) {
      this.errorMessage = extractErrorMessage(error);
      this.successMessage = '';
    }
  }

  onSaveAs() {
    try {
      this.store.saveAsNextVersion().subscribe({
        next: (result) => {
          this.errorMessage = '';
          this.successMessage = result.message;
        },
        error: (error: unknown) => {
          this.store.setServerErrors(error);
          this.errorMessage = extractErrorMessage(error);
          this.successMessage = '';
        },
      });
    } catch (error) {
      this.errorMessage = extractErrorMessage(error);
      this.successMessage = '';
    }
  }
}
