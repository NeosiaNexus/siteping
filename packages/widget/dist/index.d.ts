import { SitepingConfig, SitepingInstance } from './siteping-core.js';
export { AnchorData, AnnotationPayload, AnnotationResponse, FeedbackPayload, FeedbackResponse, FeedbackStatus, FeedbackType, PageScope, RectData, SitepingConfig, SitepingInstance, SitepingPublicEvents, SitepingStore } from './siteping-core.js';

interface Identity {
    name: string;
    email: string;
}

/**
 * Initialize the Siteping feedback widget.
 *
 * @example
 * ```ts
 * import { initSiteping } from '@siteping/widget'
 *
 * const { destroy } = initSiteping({
 *   endpoint: '/api/siteping',
 *   projectName: 'my-project',
 * })
 * ```
 */
declare function initSiteping(config: SitepingConfig): SitepingInstance;

export { type Identity, initSiteping };
