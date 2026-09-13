import React, { useState } from 'react';
import { Settings, X, Key, ShieldCheck, Layers, Wifi, Save, Check } from 'lucide-react';
import { getStoredOrsApiKey, saveOrsApiKey } from '../services/profileStorage';

export default function SettingsModal({ onClose, mapTheme, onToggleMapTheme }) {
  const [apiKey, setApiKey] = useState(getStoredOrsApiKey());
  const [isSaved, setIsSaved] = useState(false);
  const [testStatus, setTestStatus] = useState('idle'); // 'idle' | 'testing' | 'valid' | 'invalid'
  const [testMsg, setTestMsg] = useState('');

  const handleTestKey = async () => {
    const key = apiKey.trim();
    if (!key) {
      setTestStatus('invalid');
      setTestMsg('Введіть API ключ для перевірки');
      return;
    }

    setTestStatus('testing');
    try {
      // Test with valid road coordinates (Lviv Ring Road M-06)
      const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-hgv/geojson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': key },
        body: JSON.stringify({ coordinates: [[24.015, 49.795], [24.025, 49.798]] })
      });

      if (res.ok) {
        setTestStatus('valid');
        setTestMsg('✓ Ключ перевірено! Вантажна навігація ORS HGV АКТИВНА 🚛');
      } else {
        const err = await res.json().catch(() => ({}));
        setTestStatus('invalid');
        setTestMsg(`❌ Відмова сервера ORS (${res.status}): ${err.error?.message || err.error || 'Недійсний ключ'}`);
      }
    } catch (e) {
      setTestStatus('invalid');
      setTestMsg("❌ Помилка з'єднання з сервером OpenRouteService");
    }
  };

  const handleSaveKey = (e) => {
    e.preventDefault();
    saveOrsApiKey(apiKey);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-700 text-slate-200 rounded-lg border border-slate-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Налаштування TruckNav PWA</h2>
              <p className="text-xs text-slate-400">Ключі API, картографія та офлайн-режим</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">

          {/* OpenRouteService API Key Form */}
          <form onSubmit={handleSaveKey} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400 shrink-0" />
                <label className="text-xs font-bold text-slate-200">Ключ OpenRouteService API (безкоштовний):</label>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Отримайте безкоштовний вантажний API ключ (56 символів) на <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noreferrer" className="text-blue-400 underline font-semibold">openrouteservice.org</a>.
            </p>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle'); }}
              placeholder="Вставте API Key або токен сюди..."
              className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />

            {/* Live Key Test Status Msg */}
            {testMsg && (
              <div className={`p-2.5 rounded-lg text-xs font-medium border ${
                testStatus === 'valid' ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-300' : 'bg-rose-950/80 border-rose-600/60 text-rose-300'
              }`}>
                {testMsg}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 gap-2">
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testStatus === 'testing' || !apiKey.trim()}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition"
              >
                {testStatus === 'testing'
                  ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <span>🔍 Перевірити ключ</span>}
              </button>

              <button
                type="submit"
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition shadow-md"
              >
                {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>Зберегти</span>
              </button>
            </div>
          </form>

          {/* Map Theme Toggle */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Тема карти</span>
                <span className="text-[11px] text-slate-400">Поточний стиль: {mapTheme === 'dark' ? 'Нічна темна' : 'Денна світла'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleMapTheme}
              className="bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 transition"
            >
              Переключити
            </button>
          </div>

          {/* PWA Offline Status */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5">
            <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-slate-200 block">PWA Offline & Service Worker</span>
              <span className="text-[11px] text-slate-400">
                Додаток кешує статичні ресурси та тайли карти в браузері для роботи в автономному режимі.
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
