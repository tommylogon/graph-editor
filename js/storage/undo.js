// Snapshot-based undo/redo history
export const undoMixin = {
    _createSnapshot() {
        return {
            graphName: this.graphName,
            nextNodeId: this.nextNodeId,
            nodes: JSON.parse(JSON.stringify(Array.from(this.nodes.values()))),
            edges: JSON.parse(JSON.stringify(Array.from(this.edges.values()))),
            typeStyles: JSON.parse(JSON.stringify(this.typeStyles))
        };
    },

    _pushState() {
        if (this._suspendHistory) return;
        const snapshot = this._createSnapshot();
        this.undoStack.push(snapshot);
        if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
        this.redoStack = [];
    },

    undo() {
        if (this.undoStack.length === 0) return false;
        const current = this._createSnapshot();
        this.redoStack.push(current);
        const previous = this.undoStack.pop();
        this.importJSON(previous); // Re-use import to restore state
        return true;
    },

    redo() {
        if (this.redoStack.length === 0) return false;
        const current = this._createSnapshot();
        this.undoStack.push(current);
        const next = this.redoStack.pop();
        this.importJSON(next);
        return true;
    }
};
