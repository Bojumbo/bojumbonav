import React, { useState } from 'react';
import { Truck, X, Save, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { PRESET_PROFILES } from '../services/profileStorage';

export default function VehicleProfileModal({ profile, onSave, onClose }) {
  const [formData, setFormData] = useState({ ...profile });

  const handleChange = (field, val) => {
    setFormData(prev => ({
      ...prev,
      [field]: val
    }));
  };

  const applyPreset = (preset) => {
    setFormData({ ...preset });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Профіль вантажного ТЗ</h2>
              <p className="text-xs text-slate-400">Габарити та обмеження для побудови безпечного HGV-маршруту</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          
          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Швидкі пресети конфігурацій:</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_PROFILES.map((preset) => {
                const isActive = formData.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`text-left p-2.5 rounded-xl border text-xs transition flex flex-col justify-between ${
                      isActive
                        ? 'bg-blue-600/20 border-blue-500 text-blue-200 font-semibold'
                        : 'bg-slate-800/60 border-slate-700/70 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100">{preset.name}</span>
                      {isActive && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400 font-mono">
                      {preset.weight}t | H:{preset.height}m | L:{preset.length}m
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Form Fields Grid */}
          <div className="grid grid-cols-2 gap-3">
            
            {/* Weight */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Загальна вага (тонни, t):
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="100"
                value={formData.weight}
                onChange={(e) => handleChange('weight', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Наприклад: 40.0t</span>
            </div>

            {/* Axle Load */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Навантаження на вісь (t):
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="30"
                value={formData.axleLoad}
                onChange={(e) => handleChange('axleLoad', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Наприклад: 11.5t</span>
            </div>

            {/* Height */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Висота ТЗ (метри, m):
              </label>
              <input
                type="number"
                step="0.01"
                min="1.5"
                max="5.0"
                value={formData.height}
                onChange={(e) => handleChange('height', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Для обходу мостів (напр. 3.95m)</span>
            </div>

            {/* Width */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ширина ТЗ (метри, m):
              </label>
              <input
                type="number"
                step="0.01"
                min="1.5"
                max="4.5"
                value={formData.width}
                onChange={(e) => handleChange('width', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Наприклад: 2.55m</span>
            </div>

            {/* Length */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Довжина ТЗ (метри, m):
              </label>
              <input
                type="number"
                step="0.1"
                min="3"
                max="30"
                value={formData.length}
                onChange={(e) => handleChange('length', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Наприклад: 16.5m</span>
            </div>

            {/* Max Speed */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Макс. швидкість (км/год):
              </label>
              <input
                type="number"
                step="5"
                min="50"
                max="100"
                value={formData.maxSpeed}
                onChange={(e) => handleChange('maxSpeed', parseInt(e.target.value) || 80)}
                className="w-full bg-slate-950 text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Замовчування: 80 км/год для фур</span>
            </div>

          </div>

          {/* ADR / Hazardous Cargo Toggle */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-amber-200 block">Небезпечний вантаж (ADR)</span>
                <span className="text-[10px] text-amber-400/80">Оминати тунелі та зони з обмеженням небезпечних вантажів</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={formData.hazmat}
              onChange={(e) => handleChange('hazmat', e.target.checked)}
              className="w-5 h-5 rounded border-amber-500 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition shadow-lg shadow-blue-500/25 active:scale-95"
            >
              <Save className="w-4 h-4" />
              Зберегти параметри
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
