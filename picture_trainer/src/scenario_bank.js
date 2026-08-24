/**
 * 15 variations per category — seed = categoryHash + variationIndex.
 */
const SCENARIO_CATEGORIES = [
    { id: 'random', label: 'Random Picture' },
    { id: 'azimuth', label: 'Azimuth' },
    { id: 'range', label: 'Range' },
    { id: 'wall', label: 'Wall' },
    { id: 'ladder', label: 'Ladder' },
    { id: 'champagne', label: 'Champagne' },
    { id: 'vic', label: 'Vic' },
    { id: 'cap', label: 'Cap' },
    { id: 'leading_edge', label: 'Leading Edge' },
    { id: 'waves', label: 'Waves' },
    { id: 'packages', label: 'Packages' },
    { id: 'threat', label: 'Threat' },
    { id: 'ea_bogey', label: 'EA / Bogey Dope' },
    { id: 'potd', label: 'Picture of the Day' }
];

const VARIATIONS_PER_CATEGORY = 15;

function categorySeed(categoryId, variationIndex) {
    let h = 0;
    const s = `${categoryId}_${variationIndex}`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h) + variationIndex * 997;
}

function randomBullseye(rng) {
    return {
        bearing: Math.floor(rng() * 360),
        range: 0
    };
}

function listVariations(categoryId) {
    const out = [];
    for (let i = 1; i <= VARIATIONS_PER_CATEGORY; i++) {
        out.push({
            category: categoryId,
            variation: i,
            seed: categorySeed(categoryId, i),
            label: `${SCENARIO_CATEGORIES.find(c => c.id === categoryId)?.label || categoryId} #${i}`
        });
    }
    return out;
}

function pickRandomVariation(rng) {
    const cat = SCENARIO_CATEGORIES[Math.floor(rng() * SCENARIO_CATEGORIES.length)];
    const varIdx = 1 + Math.floor(rng() * VARIATIONS_PER_CATEGORY);
    return {
        category: cat.id,
        variation: varIdx,
        seed: categorySeed(cat.id, varIdx)
    };
}

if (typeof window !== 'undefined') {
    window.SCENARIO_CATEGORIES = SCENARIO_CATEGORIES;
    window.VARIATIONS_PER_CATEGORY = VARIATIONS_PER_CATEGORY;
    window.categorySeed = categorySeed;
    window.randomBullseye = randomBullseye;
    window.listVariations = listVariations;
    window.pickRandomVariation = pickRandomVariation;
}
