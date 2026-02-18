import { HttpErrorResponse } from '@angular/common/http';

export function extractErrorMessage(error: unknown): string {
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
