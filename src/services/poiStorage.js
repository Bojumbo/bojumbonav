// POI (Points of Interest) Management Service
const POI_STORAGE_KEY = 'trucknav_custom_pois';

export const POI_CATEGORIES = {
  parking: { label: 'TIR Park', icon: 'ParkingSquare', color: '#3b82f6', bg: 'bg-blue-600' },
  supermarket: { label: 'Store (Truck Access)', icon: 'ShoppingCart', color: '#10b981', bg: 'bg-emerald-600' },
  fuel: { label: 'Gas Station (TIR)', icon: 'Fuel', color: '#f59e0b', bg: 'bg-amber-600' },
  laundry: { label: 'Shower / Laundry', icon: 'ShowerHead', color: '#06b6d4', bg: 'bg-cyan-600' },
  border: { label: 'Border / Customs', icon: 'ShieldAlert', color: '#ef4444', bg: 'bg-red-600' },
  service: { label: 'Truck Repair', icon: 'Wrench', color: '#8b5cf6', bg: 'bg-purple-600' },
  other: { label: 'Other', icon: 'MapPin', color: '#64748b', bg: 'bg-slate-600' },
};

// Default high-value TIR POIs across Ukraine & Europe for immediate demo usability
const INITIAL_DEMO_POIS = [
  {
    id: 'poi-1',
    name: 'TIR Parking Krakovets (UA-PL Border)',
    category: 'border',
    coordinates: [34.9080, 49.9570], // [lon, lat]
    description: 'Охоронюваний TIR паркінг перед кордоном Краківець. Є душ, кафе та WiFi.',
    importedFrom: 'System Demo',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'poi-2',
    name: 'Shell TIR Station & Park A4 (Kraków East)',
    category: 'fuel',
    coordinates: [20.0820, 50.0410],
    description: 'Велика заправка Shell на A4. Зручний заїзд для 40-тонок, заміна AdBlue, душ.',
    importedFrom: 'System Demo',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'poi-3',
    name: 'Kaufland TIR Access (Przemysl)',
    category: 'supermarket',
    coordinates: [22.7680, 49.7820],
    description: 'Супермаркет з великим майданчиком. Можна запаркувати фуру на 45 хв для закупівлі.',
    importedFrom: 'System Demo',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'poi-4',
    name: 'Autohof Euro-Rastpark (A8 Munich-Salzburg)',
    category: 'parking',
    coordinates: [12.8340, 47.8120],
    description: 'Німецький автогоф з високим рівнем безпеки, рестораном та пральними машинами.',
    importedFrom: 'System Demo',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'poi-5',
    name: 'Waberer\'s TIR Service Center (Budapest M0)',
    category: 'service',
    coordinates: [18.9830, 47.3820],
    description: 'Сервіс вантажівок, шиномонтаж та комп\'ютерна діагностика.',
    importedFrom: 'System Demo',
    updatedAt: new Date().toISOString(),
  }
];

export function getStoredPois() {
  try {
    const raw = localStorage.getItem(POI_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(POI_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_POIS));
      return INITIAL_DEMO_POIS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse saved POIs', e);
    return INITIAL_DEMO_POIS;
  }
}

export function savePois(pois) {
  try {
    localStorage.setItem(POI_STORAGE_KEY, JSON.stringify(pois));
    window.dispatchEvent(new CustomEvent('trucknav:pois-updated', { detail: pois }));
  } catch (e) {
    console.error('Failed to save POIs', e);
  }
}

export function addPoi(poiData) {
  const current = getStoredPois();
  const newPoi = {
    id: 'poi-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    name: poiData.name || 'Нова точка',
    category: poiData.category || 'other',
    coordinates: poiData.coordinates, // [longitude, latitude]
    description: poiData.description || '',
    importedFrom: poiData.importedFrom || 'User Added',
    updatedAt: new Date().toISOString(),
  };
  const updated = [newPoi, ...current];
  savePois(updated);
  return newPoi;
}

export function deletePoi(id) {
  const current = getStoredPois();
  const updated = current.filter(p => p.id !== id);
  savePois(updated);
}

export function importPoisBatch(newPoisList, sourceName = 'Imported File') {
  const current = getStoredPois();
  const formatted = newPoisList.map((p, idx) => ({
    id: 'poi-imp-' + Date.now() + '-' + idx,
    name: p.name || 'Точка ' + (idx + 1),
    category: p.category || detectCategoryFromName(p.name, p.description),
    coordinates: p.coordinates, // [lon, lat]
    description: p.description || '',
    importedFrom: sourceName,
    updatedAt: new Date().toISOString(),
  }));

  const combined = [...formatted, ...current];
  savePois(combined);
  return formatted.length;
}

function detectCategoryFromName(name = '', desc = '') {
  const text = (name + ' ' + desc).toLowerCase();
  if (text.includes('park') || text.includes('парк') || text.includes('стоянка') || text.includes('rest')) return 'parking';
  if (text.includes('shop') || text.includes('store') || text.includes('market') || text.includes('магазин') || text.includes('biedronka') || text.includes('lidl') || text.includes('kaufland')) return 'supermarket';
  if (text.includes('fuel') || text.includes('gas') || text.includes('azs') || text.includes('азс') || text.includes('заправка') || text.includes('shell') || text.includes('bp') || text.includes('orlen') || text.includes('wog') || text.includes('okko')) return 'fuel';
  if (text.includes('wash') || text.includes('shower') || text.includes('душ') || text.includes('прал')) return 'laundry';
  if (text.includes('border') || text.includes('custom') || text.includes('кордон') || text.includes('митниця')) return 'border';
  if (text.includes('tir') || text.includes('service') || text.includes('сто') || text.includes('ремонт')) return 'service';
  return 'other';
}
