// js/storage/db.js

let db = null;
const DB_NAME = 'WorldGraphDB';
const STORE_NAME = 'saveData';
const DB_VERSION = 1;

/**
 * Initialize IndexedDB connection.
 * @returns {Promise<void>}
 */
export async function initDB() {
    console.log('🗄️ Initializing IndexedDB...');
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('✅ IndexedDB initialized');
            resolve();
        };

        request.onerror = (event) => {
            console.error('❌ IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Save a graph to IndexedDB.
 * @param {string} graphName - Name of the graph
 * @param {Object} data - Graph data to save
 * @returns {Promise<void>}
 */
export async function saveGraph(graphName, data) {
    if (!db) await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(data, `graph_${graphName}`);
        tx.objectStore(STORE_NAME).put(graphName, 'last_active_name');
        resolve();
    });
}

/**
 * Load the last active graph from IndexedDB.
 * @returns {Promise<Object|null>}
 */
export async function loadLastActive() {
    if (!db) await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const reqLast = store.get('last_active_name');
        reqLast.onsuccess = () => {
            const lastName = reqLast.result;
            if (lastName) {
                const reqGraph = store.get(`graph_${lastName}`);
                reqGraph.onsuccess = () => {
                    resolve(reqGraph.result || null);
                };
                reqGraph.onerror = () => resolve(null);
            } else {
                resolve(null);
            }
        };
        reqLast.onerror = () => resolve(null);
    });
}

/**
 * Load a specific graph by name.
 * @param {string} name - Graph name
 * @returns {Promise<Object|null>}
 */
export async function loadGraph(name) {
    if (!db) await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(`graph_${name}`);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
}

/**
 * List all stored graph names.
 * @returns {Promise<string[]>}
 */
export async function listStoredGraphs() {
    if (!db) await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => {
            const keys = req.result;
            resolve(keys.filter(k => k.startsWith('graph_')).map(k => k.replace('graph_', '')));
        };
        req.onerror = () => resolve([]);
    });
}