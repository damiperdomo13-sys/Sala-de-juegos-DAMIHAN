import React, { useState } from 'react';
import {
  Cloud,
  CloudOff,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  Trash2,
  ExternalLink,
  Key,
  Database,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  getActiveFirebaseConfig,
  saveCustomFirebaseConfig,
  FirebaseConfig,
  testFirebaseConnection,
} from '../utils/firebase';
import { soundEffects } from '../utils/audio';

interface FirebaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const FirebaseModal: React.FC<FirebaseModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const currentConfig = getActiveFirebaseConfig();
  const [jsonInput, setJsonInput] = useState('');
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [projectId, setProjectId] = useState(currentConfig?.projectId || '');
  const [databaseURL, setDatabaseURL] = useState(currentConfig?.databaseURL || '');
  const [appId, setAppId] = useState(currentConfig?.appId || '');

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [copiedRules, setCopiedRules] = useState(false);

  if (!isOpen) return null;

  const isConnected = !!currentConfig;

  // Auto-parse JSON if user pastes full firebaseConfig snippet from console
  const handleParseJson = (text: string) => {
    setJsonInput(text);
    try {
      let clean = text.trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        clean = match[0];
      }

      // Convert JS object keys without quotes if needed
      clean = clean
        .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":')
        .replace(/'/g, '"')
        .replace(/,\s*\}/g, '}');

      const parsed = JSON.parse(clean);
      if (parsed.apiKey) setApiKey(parsed.apiKey);
      if (parsed.projectId) {
        setProjectId(parsed.projectId);
        if (!parsed.databaseURL) {
          setDatabaseURL(`https://${parsed.projectId}-default-rtdb.firebaseio.com`);
        }
      }
      if (parsed.databaseURL) setDatabaseURL(parsed.databaseURL);
      if (parsed.appId) setAppId(parsed.appId);

      setStatusMessage('¡Configuración detectada automáticamente y cargada en los campos!');
      setTestStatus('idle');
    } catch {
      // Ignore intermediate typing
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey || !projectId) {
      alert('Por favor ingresa al menos la API Key y el Project ID antes de probar.');
      return;
    }

    setTestStatus('testing');
    setStatusMessage('Comprobando conexión con Firebase Realtime Database...');

    const configToTest: FirebaseConfig = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      databaseURL:
        databaseURL.trim() || `https://${projectId.trim()}-default-rtdb.firebaseio.com`,
      authDomain: `${projectId.trim()}.firebaseapp.com`,
      appId: appId.trim() || '',
    };

    const res = await testFirebaseConnection(configToTest);
    if (res.success) {
      setTestStatus('success');
      setStatusMessage(res.message);
      soundEffects.playWin();
    } else {
      setTestStatus('error');
      setStatusMessage(res.message);
      soundEffects.playError();
    }
  };

  const handleSave = async () => {
    if (!apiKey || !projectId) {
      alert('Por favor ingresa al menos la API Key y el Project ID de Firebase.');
      return;
    }

    const newConfig: FirebaseConfig = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      databaseURL:
        databaseURL.trim() || `https://${projectId.trim()}-default-rtdb.firebaseio.com`,
      authDomain: `${projectId.trim()}.firebaseapp.com`,
      appId: appId.trim() || '',
    };

    await saveCustomFirebaseConfig(newConfig);
    soundEffects.playWin();
    onConfigChanged();
    setTestStatus('success');
    setStatusMessage('¡Configuración guardada! Sincronización en la nube en tiempo real activada.');
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleClear = async () => {
    if (confirm('¿Deseas desvincular Firebase y volver al modo de respaldo local offline?')) {
      await saveCustomFirebaseConfig(null);
      setApiKey('');
      setProjectId('');
      setDatabaseURL('');
      setAppId('');
      setJsonInput('');
      soundEffects.playTick(1.0);
      onConfigChanged();
      setTestStatus('idle');
      setStatusMessage('Modo local (localStorage) activado.');
    }
  };

  const sampleRules = `{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}`;

  const handleCopyRules = () => {
    navigator.clipboard?.writeText(sampleRules);
    setCopiedRules(true);
    soundEffects.playTick(1.1);
    setTimeout(() => setCopiedRules(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-cyan-500/40 rounded-3xl p-5 md:p-6 max-w-xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            {isConnected ? (
              <Cloud className="w-6 h-6 text-emerald-400 animate-pulse" />
            ) : (
              <CloudOff className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <span>Sincronización en Tiempo Real</span>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full font-mono">
                Firebase RTDB
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Conexión bidireccional entre Vista Cliente (PC) y Administrador (Móvil)
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-mono my-3 ${
            isConnected
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
              }`}
            />
            <span>
              {isConnected
                ? 'Nube Firebase Activa: PC y Teléfono sincronizados en vivo'
                : 'Modo Local Activo: Operando con respaldo offline (localStorage)'}
            </span>
          </span>
          {isConnected && (
            <button
              onClick={handleClear}
              className="text-rose-400 hover:text-rose-300 text-[11px] underline cursor-pointer"
            >
              Desvincular
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 text-xs text-slate-300 space-y-2 mb-4">
          <span className="font-bold text-white text-sm flex items-center gap-1.5">
            <Database className="w-4 h-4 text-cyan-400" />
            ¿Cómo activarlo gratis en 3 pasos?
          </span>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1 text-[11px] leading-relaxed">
            <li>
              Crea un proyecto gratis en{' '}
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 underline font-semibold inline-flex items-center gap-0.5"
              >
                Firebase Console <ExternalLink className="w-3 h-3" />
              </a>.
            </li>
            <li>
              En el menú lateral ve a <strong>Compilación</strong> → <strong>Realtime Database</strong>, pulsa <em>"Crear base de datos"</em> y en la pestaña <strong>Reglas</strong> coloca:
              <div className="my-1.5 p-2 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-[11px] text-amber-300">
                <code>{`{ "rules": { ".read": true, ".write": true } }`}</code>
                <button
                  type="button"
                  onClick={handleCopyRules}
                  className="text-cyan-400 hover:text-cyan-300 text-[10px] ml-2 flex items-center gap-1 px-2 py-0.5 bg-slate-900 rounded border border-slate-700 cursor-pointer"
                >
                  {copiedRules ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRules ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </li>
            <li>
              En la <strong>Configuración del Proyecto</strong> (icono ⚙️) → <em>"Tus apps"</em> → Web (<code className="text-amber-400">&lt;/&gt;</code>), copia el bloque <code className="text-emerald-400">firebaseConfig</code> y pégalo abajo.
            </li>
          </ol>
        </div>

        {/* Quick Paste JSON */}
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Opción 1: Pegar bloque JSON directo de Firebase (Rápido)
          </label>
          <textarea
            rows={2}
            placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "sala-damihan",\n  databaseURL: "https://..."\n};`}
            value={jsonInput}
            onChange={(e) => handleParseJson(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Inputs */}
        <div className="space-y-2.5 mb-4">
          <label className="text-xs font-semibold text-slate-300 block">
            Opción 2: Campos individuales
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">API Key</span>
              <input
                type="text"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Project ID</span>
              <input
                type="text"
                placeholder="sala-de-juegos-damihan"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block mb-0.5">
              Database URL (Realtime Database)
            </span>
            <input
              type="text"
              placeholder="https://sala-de-juegos-damihan-default-rtdb.firebaseio.com"
              value={databaseURL}
              onChange={(e) => setDatabaseURL(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mb-4 text-xs font-mono p-3 rounded-xl border flex items-center gap-2 ${
              testStatus === 'error'
                ? 'bg-rose-950/40 border-rose-800/40 text-rose-300'
                : testStatus === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                : 'bg-cyan-950/40 border-cyan-800/40 text-cyan-300'
            }`}
          >
            {testStatus === 'error' && <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
            {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
            {testStatus === 'testing' && <RefreshCw className="w-4 h-4 shrink-0 text-cyan-400 animate-spin" />}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
            <span>Probar Conexión</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar y Activar Nube</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all cursor-pointer border border-slate-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
