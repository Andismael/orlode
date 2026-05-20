"use strict";
/**
 * Feature flags for gradual rollout of beta agents.
 *
 * Add a Firestore companyId to a Set below to grant that tenant access.
 * Returning false from the helper makes the corresponding routes respond
 * 403 { error: 'feature_disabled' } so the frontend can show an "arrive bientôt"
 * empty state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATA_SCIENTIST_ALLOWED_COMPANIES = void 0;
exports.isDataScientistEnabled = isDataScientistEnabled;
exports.DATA_SCIENTIST_ALLOWED_COMPANIES = new Set([
    // Adel (super-admin / owner) — has the page enabled for internal testing while
    // we replace mocked correlations & predictions with real cross-module math.
    'J4vwyMVHP3ZeHdTsC1gOMjeOTRA2',
]);
function isDataScientistEnabled(companyId) {
    if (!companyId)
        return false;
    return exports.DATA_SCIENTIST_ALLOWED_COMPANIES.has(companyId);
}
//# sourceMappingURL=featureFlags.js.map