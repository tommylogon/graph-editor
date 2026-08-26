// js/ui/utils.js

/**
 * Check if all given node IDs are currently visible in the visualization.
 * @param  {...any} ids - Node IDs to check
 * @returns {boolean}
 */
export function areNodesVisible(...ids) {
    const vis = window.__vis;
    if (!vis) return true; // fallback if visualization not ready
    for (const id of ids) {
        const entry = vis.nodes.get(id);
        if (!entry || !entry.mesh.visible) return false;
    }
    return true;
}

/**
 * Validate edge creation – both nodes must be visible.
 * Shows an alert if invalid.
 * @param {string|number} sourceId
 * @param {string|number} targetId
 * @returns {boolean}
 */
export function validateEdgeCreation(sourceId, targetId) {
    if (!areNodesVisible(sourceId, targetId)) {
        const sourceVis = window.__vis?.nodes.get(sourceId)?.mesh.visible;
        const targetVis = window.__vis?.nodes.get(targetId)?.mesh.visible;
        const reasons = [];
        if (sourceVis === false) reasons.push('source node is hidden (filtered/collapsed)');
        if (targetVis === false) reasons.push('target node is hidden (filtered/collapsed)');
        alert(`Cannot create edge: ${reasons.join('; ')}. Please make both nodes visible first.`);
        return false;
    }
    return true;
}