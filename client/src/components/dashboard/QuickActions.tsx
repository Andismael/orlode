import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Upload, Video, Users, BarChart3, Settings } from 'lucide-react';

interface QuickAction {
  label: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  href: string;
  bgColor: string;
}

const actions: QuickAction[] = [
  { label: 'Poser une question', description: 'Discuter avec vos donnees', icon: MessageSquare, href: '/chat',      bgColor: '#0092FF' },
  { label: 'Ajouter un doc',   description: 'Base de connaissances',     icon: Upload,        href: '/agents/knowledge',      bgColor: '#00A550' },
  { label: 'Reunions',         description: 'Notes et transcriptions',   icon: Video,         href: '/meetings',  bgColor: '#FFA200' },
  { label: 'Annuaire',         description: 'Gerer les employes',        icon: Users,         href: '/faces',     bgColor: '#FF009D' },
  { label: 'Analytique',       description: 'Statistiques d\'usage',     icon: BarChart3,     href: '/analytics', bgColor: '#0097B2' },
  { label: 'Parametres',       description: 'Configurer l\'agent AI',    icon: Settings,      href: '/settings',  bgColor: '#0049FF' },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Actions rapides</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.href}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(action.href)}
              className="flex flex-col items-start gap-2.5 p-3.5 rounded-xl transition-all duration-200 text-left relative overflow-hidden"
              style={{ background: action.bgColor }}
            >
              {/* Gloss overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 60%)' }} />
              <div className="w-9 h-9 rounded-lg flex items-center justify-center relative" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Icon size={16} color="#fff" />
              </div>
              <div className="relative">
                <p className="text-xs font-semibold text-white">{action.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{action.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default QuickActions;
