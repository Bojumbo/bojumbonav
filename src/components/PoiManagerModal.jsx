import React, { useState } from 'react';
import { FolderDown, X, Upload, MapPin, Trash2, Plus, Filter, FileText, CheckCircle } from 'lucide-react';
import { parsePoiFile } from '../services/kmlParserService';
import { importPoisBatch, addPoi, deletePoi, POI_CATEGORIES } from '../services/poiStorage';

export default function PoiManagerModal({ pois, onRefreshPois, onClose, onSelectPoi }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'upload' | 'add'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Manual POI Add Form
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('parking');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const result = await parsePoiFile(file);
      if (result.pois.length === 0) {
        setUploadStatus({ type: 'error', message: 'Файл не містить допустимих точок (Coordinates).' });
      } else {
        const count = importPoisBatch(result.pois, result.filename);
        setUploadStatus({ type: 'success', message: `Успішно імпортовано ${count} точок з файлу ${result.filename}!` });
        onRefreshPois();
      }
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message || 'Помилка розбору файлу.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddManualPoi = (e) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon)) {
      alert('Будь ласка, введіть дійсні GPS координати (широту та довготу).');
      return;
    }

    addPoi({
      name: manualName,
      category: manualCategory,
      coordinates: [lon, lat],
      description: manualDesc,
      importedFrom: 'Ручне створення'
    });

    setManualName('');
    setManualLat('');
    setManualLon('');
    setManualDesc('');
    setActiveTab('list');
    onRefreshPois();
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (confirm('Видалити цю точку зі збережених?')) {
      deletePoi(id);
      onRefreshPois();
    }
  };

  const filteredPois = pois.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = !searchFilter.trim() || 
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
      (p.description && p.description.toLowerCase().includes(searchFilter.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Менеджер Точок POI та KML/GeoJSON</h2>
              <p className="text-xs text-slate-400">Імпортуйте власні карти з Google Maps або створюйте нові TIR-точки</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'list'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Список точок ({pois.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Імпорт файлу KML / GeoJSON
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Додати ручну точку
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="p-4 overflow-y-auto flex-1">

          {/* TAB 1: LIST POIS */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              
              {/* Category Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Пошук за назвою чи описом..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="flex-1 bg-slate-950 text-xs px-3 py-2 rounded-xl border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-950 text-xs px-3 py-2 rounded-xl border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="all">Усі категорії</option>
                  {Object.entries(POI_CATEGORIES).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
              </div>

              {/* POI List Cards */}
              {filteredPois.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Точок не знайдено. Завантажте файл .kml або додайте точку ручником!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredPois.map((poi) => {
                    const catInfo = POI_CATEGORIES[poi.category] || POI_CATEGORIES.other;
                    return (
                      <div
                        key={poi.id}
                        onClick={() => { onSelectPoi(poi); onClose(); }}
                        className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-600 rounded-xl p-3 cursor-pointer transition flex flex-col justify-between group shadow-sm"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${catInfo.bg}`}>
                              {catInfo.label}
                            </span>
                            <button
                              onClick={(e) => handleDelete(poi.id, e)}
                              className="text-slate-500 hover:text-rose-400 p-1 transition"
                              title="Видалити"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <h4 className="font-bold text-xs text-slate-100 group-hover:text-blue-300 transition line-clamp-1">
                            {poi.name}
                          </h4>
                          {poi.description && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {poi.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{poi.coordinates[1].toFixed(4)}, {poi.coordinates[0].toFixed(4)}</span>
                          <span className="text-slate-500 text-[9px]">{poi.importedFrom}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: UPLOAD KML / GEOJSON FILE */}
          {activeTab === 'upload' && (
            <div className="space-y-4 py-2">
              <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 bg-slate-950/60 rounded-2xl p-8 text-center transition flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Завантажте файл .kml або .geojson</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Підтримуються файли, експортовані з <strong>Google My Maps</strong>, Google Takeout та OSM.
                  </p>
                </div>

                <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/20 active:scale-95 mt-2">
                  <span>Обрати файл на пристрої</span>
                  <input
                    type="file"
                    accept=".kml,.kmz,.geojson,.json,.gpx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {isUploading && (
                <div className="flex items-center justify-center gap-2 py-4 text-emerald-400 text-xs font-semibold">
                  <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                  <span>Розбір файлу KML та імпорт точок...</span>
                </div>
              )}

              {uploadStatus && (
                <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  uploadStatus.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {uploadStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                  <span>{uploadStatus.message}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADD MANUAL POI */}
          {activeTab === 'add' && (
            <form onSubmit={handleAddManualPoi} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Назва точки:</label>
                <input
                  type="text"
                  placeholder="Наприклад: Стоянка Waberer's A4"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-slate-950 text-xs px-3 py-2 rounded-xl border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Категорія:</label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="w-full bg-slate-950 text-xs px-3 py-2 rounded-xl border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                >
                  {Object.entries(POI_CATEGORIES).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Широта (Latitude):</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Наприклад: 50.0410"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full bg-slate-950 text-xs px-3 py-2 rounded-xl border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Довгота (Longitude):</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Наприклад: 20.0820"
                    value={manualLon}
                    onChange={(e) => setManualLon(e.target.value)}
                    className="w-full bg-slate-950 text-xs px-3 py-2 rounded-xl border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Коментар / Корисні деталі:</label>
                <textarea
                  rows="2"
                  placeholder="Опис під'їзду, наявність душа, ціна стоянки тощо..."
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="w-full bg-slate-950 text-xs p-3 rounded-xl border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-lg shadow-amber-600/20 active:scale-95"
              >
                Зберегти точку на карті
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
