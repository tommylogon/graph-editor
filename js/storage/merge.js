// Duplicate node merging
export const mergeMixin = {
    mergeDuplicateNodes(labelToMerge, nodeType) {
        this._pushState();
        const lowerLabel = labelToMerge.toLowerCase();

        // 1. Find nodes matching BOTH label and type
        const matchingNodes = Array.from(this.nodes.values()).filter(n =>
            n.type === nodeType && n.label.toLowerCase() === lowerLabel
        );

        if (matchingNodes.length < 2) return; // Nothing to merge

        // 2. Sort by ID so the oldest node becomes the "Primary" survivor
        matchingNodes.sort((a, b) => a.id - b.id);
        const primary = matchingNodes[0];
        const duplicates = matchingNodes.slice(1);

        duplicates.forEach(dup => {
            // Append descriptions so no text is lost
            if (dup.properties.description) {
                const sep = primary.properties.description ? '\n\n---\n' : '';
                primary.properties.description += `${sep}[Merged from ID ${dup.id}]: ${dup.properties.description}`;
            }

            // Re-point edges
            const edgesToRecreate = [];
            this.edges.forEach(edge => {
                if (edge.source === dup.id || edge.target === dup.id) {
                    edgesToRecreate.push({ ...edge });
                }
            });

            edgesToRecreate.forEach(edge => {
                this.deleteEdge(edge.id); // Remove old visual

                const newSource = edge.source === dup.id ? primary.id : edge.source;
                const newTarget = edge.target === dup.id ? primary.id : edge.target;

                // Avoid loops
                if (newSource !== newTarget) {
                    const newId = `e${Date.now()}-${Math.random()}`;
                    const newEdge = {
                        id: newId,
                        source: newSource,
                        target: newTarget,
                        type: edge.type,
                        label: edge.label,
                        description: edge.description,
                        attributes: { ...edge.attributes }
                    };
                    this.edges.set(newId, newEdge);
                    this.dispatchEvent(new CustomEvent('edgeAdded', { detail: newEdge }));
                }
            });

            // Delete the duplicate node
            this.nodes.delete(dup.id);
            this.dispatchEvent(new CustomEvent('nodeRemoved', { detail: { id: dup.id } }));
        });

        // 3. Clean up parallel edges (multiple connections between same two nodes)
        const seenEdges = new Set();
        const edgesToRemove = [];
        this.edges.forEach(edge => {
            // Create a unique key for the connection (A-B or B-A) + Label
            const pair = [edge.source, edge.target].sort().join('-');
            const key = `${pair}::${edge.label}`;

            if (seenEdges.has(key)) {
                edgesToRemove.push(edge.id);
            } else {
                seenEdges.add(key);
            }
        });

        edgesToRemove.forEach(id => {
            this.deleteEdge(id);
        });

        this.dispatchEvent(new CustomEvent('nodeUpdated', { detail: primary }));
        this.save();
    }
};
