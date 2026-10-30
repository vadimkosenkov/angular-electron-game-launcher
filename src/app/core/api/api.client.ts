import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import type { ApiSuccess, HealthStatus } from '@shared/api.model';
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
}

function unwrap<T>(response: Observable<ApiSuccess<T>>): Observable<T> {
  return response.pipe(map((envelope) => envelope.data));
}
