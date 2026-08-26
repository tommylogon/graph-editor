// Default sprite generation (simple colored circle with first letter)
export const DEFAULT_SPRITE_COLORS = {
    person: '#ffaa88',
    location: '#88ffaa',
    item: '#ffcc88',
    concept: '#aa88ff',
    group: '#88aaff',
    event: '#ff88aa',
    file: '#aaff88',
    folder: '#ffaaff'
};

export function generateDefaultSprite(type) {
    const color = DEFAULT_SPRITE_COLORS[type] || '#88aaff';
    const letter = type.charAt(0).toUpperCase();
    const size = 512;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 10}" fill="${color}" stroke="white" stroke-width="20"/>
        <text x="${size / 2}" y="${size / 2}" font-family="Arial, sans-serif" font-size="${size / 2}" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">${letter}</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}
