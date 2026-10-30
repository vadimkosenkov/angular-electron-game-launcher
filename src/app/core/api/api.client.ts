import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import type { ApiSuccess, HealthStatus } from '@shared/api.model';
import type { Game } from '@shared/game.model';

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
}

function unwrap<T>(response: Observable<ApiSuccess<T>>): Observable<T> {
  return response.pipe(map((envelope) => envelope.data));
}
