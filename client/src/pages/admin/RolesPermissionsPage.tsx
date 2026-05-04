import React, { useState } from 'react';

const ROLES = ['admin', 'manager', 'employee'];
const PERMISSIONS = [
  { key: 'uploadDocuments', label: 'Upload documents' },
  { key: 'deleteDocuments', label: 'Supprimer documents' },
  { key: 'viewAnalytics', label: 'Voir analytics' },
  { key: 'manageUsers', label: 'Gérer utilisateurs' },
  { key: 'viewAuditLogs', label: 'Voir audit logs' },
  { key: 'configureAgents', label: 'Configurer agents' },
  { key: 'exportData', label: 'Exporter données' },
  { key: 'accessConfidential', label: 'Documents confidentiels' },
  { key: 'manageBilling', label: 'Gérer facturation' },
];

const DEFAULT_MATRIX: Record<string, Record<string, boolean>> = {
  admin: Object.fromEntries(PERMISSIONS.map(p => [p.key, true])),
  manager: Object.fromEntries(PERMISSIONS.map((p, i) => [p.key, i < 6])),
  employee: Object.fromEntries(PERMISSIONS.map((p, i) => [p.key, i < 2])),
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`block w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export default function RolesPermissionsPage() {
  const [matrix, setMatrix] = useState(DEFAULT_MATRIX);

  const toggle = (role: string, perm: string) =>
    setMatrix(p => ({ ...p, [role]: { ...p[role], [perm]: !p[role][perm] } }));

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rôles & Permissions</h1>
        <p className="text-sm text-gray-500 mt-0.5">Définissez les droits de chaque rôle</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-48">Permission</th>
              {ROLES.map(r => (
                <th key={r} className="text-center text-sm font-semibold text-gray-700 px-4 py-3 capitalize">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {PERMISSIONS.map(perm => (
              <tr key={perm.key} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-700">{perm.label}</td>
                {ROLES.map(role => (
                  <td key={role} className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Toggle checked={matrix[role]?.[perm.key] ?? false} onChange={() => toggle(role, perm.key)} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
        Enregistrer les permissions
      </button>
    </div>
  );
}
