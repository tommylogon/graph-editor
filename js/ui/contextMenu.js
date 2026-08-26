// Context menu content
export const contextMenuMixin = {
    buildContextMenu() {
        this.contextMenu.innerHTML = '';
        const emptyMenu = `
            <div onclick="window.__ui.createNode('person')">Add Person</div>
            <div onclick="window.__ui.createNode('location')">Add Location</div>
            <div onclick="window.__ui.createNode('item')">Add Item</div>
            <div onclick="window.__ui.createNode('concept')">Add Concept</div>
             <div onclick="window.__ui.createNode('event')">Add Event</div> 
                    <div onclick="window.__ui.createNode('file')">Add File</div> 
                    <div onclick="window.__ui.createNode('folder')">Add Folder</div> 
            <hr>
            <div onclick="window.__ui.hideMenu()">Cancel</div>
        `;
        this.contextMenu.innerHTML = emptyMenu;
    }
};
