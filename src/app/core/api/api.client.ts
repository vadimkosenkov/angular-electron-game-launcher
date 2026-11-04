import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import type { ApiSuccess, HealthStatus } from '@shared/api.model';
import type { AvailabilityReport } from '@shared/availability.model';
import type { Game } from '@shared/game.model';
import type { UserData, UserSettings } from '@shared/user-data.model';

/**
 * The renderer's view of the local API. Every response arrives wrapped in
 * `{ data }`; unwrapping it here keeps that envelope out of the components.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  getHealth(): Observable<HealthStatus> {
    return unwrap(this.http.get<ApiSuccess<HealthStatus>>('/api/health'));
  }

  getGames(): Observable<readonly Game[]> {
    return unwrap(this.http.get<ApiSuccess<readonly Game[]>>('/api/games'));
  }

  getGame(id: string): Observable<Game> {
    return unwrap(this.http.get<ApiSuccess<Game>>(`/api/games/${id}`));
  }

  getUserData(): Observable<UserData> {
    return unwrap(this.http.get<ApiSuccess<UserData>>('/api/user-data'));
  }

  /**
   * Every write answers with the whole of the user's data, so the caller
   * replaces its state with the response instead of patching it.
   */
  putSettings(settings: UserSettings): Observable<UserData> {
    return unwrap(this.http.put<ApiSuccess<UserData>>('/api/user-data/settings', settings));
  }

  setFavourite(gameId: string, favourite: boolean): Observable<UserData> {
    const url = `/api/user-data/favourites/${encodeURIComponent(gameId)}`;
    return favourite
      ? unwrap(this.http.put<ApiSuccess<UserData>>(url, {}))
      : unwrap(this.http.delete<ApiSuccess<UserData>>(url));
  }

  /** Sent only after the main process has confirmed it opened the game. */
  recordLaunch(gameId: string): Observable<UserData> {
    const url = `/api/user-data/history/${encodeURIComponent(gameId)}`;
    return unwrap(this.http.post<ApiSuccess<UserData>>(url, {}));
  }

  clearHistory(): Observable<UserData> {
    return unwrap(this.http.delete<ApiSuccess<UserData>>('/api/user-data/history'));
  }

  getAvailability(): Observable<AvailabilityReport> {
    return unwrap(this.http.get<ApiSuccess<AvailabilityReport>>('/api/availability'));
  }

  /**
   * Asks the server to check every address in the catalog. No body and no
   * parameter: the server checks its own catalog, and the renderer has no way
   * to name a target -- which is what keeps this from being a request the
   * page can point at an address of its choosing.
   */
  checkLinks(): Observable<AvailabilityReport> {
    return unwrap(this.http.post<ApiSuccess<AvailabilityReport>>('/api/availability/check', {}));
  }
}

function unwrap<T>(response: Observable<ApiSuccess<T>>): Observable<T> {
  return response.pipe(map((envelope) => envelope.data));
}
