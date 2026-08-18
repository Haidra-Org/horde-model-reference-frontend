import { computed, inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ModelReferenceApiService } from './model-reference-api.service';

/**
 * Coarse viewer states that drive which surfaces and which vocabulary the app presents.
 *
 * These are presentation states, not a security boundary — the backend allowlists in
 * `pending_queue.requestor_ids` / `approver_ids` remain the only authority over what a
 * key may actually do.
 */
export type ViewerState = 'visitor' | 'signed-in' | 'contributor' | 'curator';

/**
 * Single source of truth for what the current viewer may see and do.
 *
 * Two axes are deliberately kept apart:
 *
 * - **Role** decides which surfaces and vocabulary are presented. A curator reading a
 *   REPLICA still gets curator framing (quality signals, risk, audit) even though no
 *   write can succeed there.
 * - **Backend writability** decides whether an action is offered. It gates the verbs,
 *   never the language.
 *
 * Components must consume these signals rather than re-deriving
 * `backendCapabilities().writable && auth.isRequestor()` locally, so the rules stay in
 * one place.
 */
@Injectable({ providedIn: 'root' })
export class ViewerCapabilitiesService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ModelReferenceApiService);

  /** Whether this deployment accepts writes at all (PRIMARY mode). */
  readonly backendWritable = computed(() => this.api.backendCapabilities().writable);

  /** Whether a valid API key is currently held. */
  readonly isSignedIn = computed(() => this.auth.isAuthenticated());

  /**
   * Whether curation surfaces and curation vocabulary should be presented.
   *
   * Intentionally role-only: it must not collapse to false on a REPLICA, or a curator
   * inspecting a replica would silently get the public wording.
   */
  readonly canSeeCuration = computed(() => this.auth.isRequestor() || this.auth.isApprover());

  /** Whether change proposals may be submitted. */
  readonly canPropose = computed(() => this.backendWritable() && this.auth.isRequestor());

  /** Whether queued changes may be approved, rejected, applied or purged. */
  readonly canApprove = computed(() => this.backendWritable() && this.auth.isApprover());

  /** Whether normalized licensing records may be edited directly. */
  readonly canEditLicensing = computed(() => this.backendWritable() && this.auth.isLicenseEditor());

  /**
   * Whether the viewer holds a valid key that carries no curation privileges.
   *
   * Used to explain the absence of contribution surfaces to someone who has signed in
   * and reasonably expects to find them.
   */
  readonly isUnprivilegedSignedIn = computed(() => this.isSignedIn() && !this.canSeeCuration());

  readonly viewerState = computed<ViewerState>(() => {
    if (this.auth.isApprover()) {
      return 'curator';
    }
    if (this.auth.isRequestor()) {
      return 'contributor';
    }
    return this.isSignedIn() ? 'signed-in' : 'visitor';
  });
}
