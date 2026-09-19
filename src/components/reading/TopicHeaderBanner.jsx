import React from 'react';
import {
  HeartPulse,
  Briefcase,
  Atom,
  Plane,
  Users,
  Leaf,
  Palette,
  Tag,
  Activity,
  Camera,
  Music,
  BookOpen,
  Utensils
} from 'lucide-react';

/**
 * Reusable Topic Header Banner Component (Matching Reference UI)
 * Maps topic names to distinct Lucide icons and harmonious color accents.
 */
export default function TopicHeaderBanner({
  topicName = 'HEALTHY LIFESTYLES',
  setInfo = '1 set (7 questions)',
  isDarkMode = false
}) {
  const normalized = topicName.toUpperCase();

  // Dynamic icon and theme resolver based on topic keywords
  const getTopicTheme = () => {
    if (normalized.includes('FITNESS') || normalized.includes('SPORT') || normalized.includes('GYM')) {
      return {
        Icon: Activity,
        bgLight: '#eff6ff',
        borderLight: '#bfdbfe',
        textLight: '#2563eb',
        iconBg: '#2563eb',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('PHOTO') || normalized.includes('CAMERA')) {
      return {
        Icon: Camera,
        bgLight: '#e0e7ff',
        borderLight: '#c7d2fe',
        textLight: '#4f46e5',
        iconBg: '#4f46e5',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('MUSIC') || normalized.includes('SONG') || normalized.includes('CONCERT')) {
      return {
        Icon: Music,
        bgLight: '#f3e8ff',
        borderLight: '#e9d5ff',
        textLight: '#7e22ce',
        iconBg: '#7e22ce',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('BOOK') || normalized.includes('READ') || normalized.includes('LIT') || normalized.includes('FILM') || normalized.includes('MOVIE') || normalized.includes('CINEMA') || normalized.includes('TEXT COHESION')) {
      return {
        Icon: BookOpen,
        bgLight: '#fffbeb',
        borderLight: '#fde68a',
        textLight: '#d97706',
        iconBg: '#d97706',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('FOOD') || normalized.includes('COOK')) {
      return {
        Icon: Utensils,
        bgLight: '#fff1f2',
        borderLight: '#fecdd3',
        textLight: '#e11d48',
        iconBg: '#e11d48',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('HEALTH') || normalized.includes('LIFESTYLE')) {
      return {
        Icon: HeartPulse,
        bgLight: '#eff6ff',
        borderLight: '#bfdbfe',
        textLight: '#2563eb',
        iconBg: '#2563eb',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('SCIENCE') || normalized.includes('TECH')) {
      return {
        Icon: Atom,
        bgLight: '#f5f3ff',
        borderLight: '#ddd6fe',
        textLight: '#7c3aed',
        iconBg: '#7c3aed',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('WORK') || normalized.includes('BUSINESS') || normalized.includes('CAREER') || normalized.includes('STUDY')) {
      return {
        Icon: Briefcase,
        bgLight: '#eff6ff',
        borderLight: '#bfdbfe',
        textLight: '#2563eb',
        iconBg: '#2563eb',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('TRAVEL') || normalized.includes('TRANSPORT')) {
      return {
        Icon: Plane,
        bgLight: '#f0fdf4',
        borderLight: '#bbf7d0',
        textLight: '#059669',
        iconBg: '#059669',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('PEOPLE') || normalized.includes('SOCIETY')) {
      return {
        Icon: Users,
        bgLightActual: '#f0fdfa',
        bgLight: '#f0fdfa',
        borderLight: '#99f6e4',
        textLight: '#0d9488',
        iconBg: '#0d9488',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('ENVIRON')) {
      return {
        Icon: Leaf,
        bgLight: '#ecfdf5',
        borderLight: '#a7f3d0',
        textLight: '#10b981',
        iconBg: '#10b981',
        iconColor: '#ffffff'
      };
    }
    if (normalized.includes('CULTURE') || normalized.includes('ART')) {
      return {
        Icon: Palette,
        bgLight: '#fff1f2',
        borderLight: '#fecdd3',
        textLight: '#e11d48',
        iconBg: '#e11d48',
        iconColor: '#ffffff'
      };
    }

    return {
      Icon: Tag,
      bgLight: '#eff6ff',
      borderLight: '#bfdbfe',
      textLight: '#2563eb',
      iconBg: '#2563eb',
      iconColor: '#ffffff'
    };
  };

  const theme = getTopicTheme();
  const IconComponent = theme.Icon;

  return (
    <div
      className="p-3.5 px-4 rounded-xl border flex items-center justify-between transition-all mb-6 shadow-2xs"
      style={{
        backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.35)' : (theme.bgLightActual || theme.bgLight),
        borderColor: isDarkMode ? 'rgba(30, 58, 138, 0.6)' : theme.borderLight
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
          style={{
            backgroundColor: theme.iconBg,
            color: theme.iconColor
          }}
        >
          <IconComponent className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
        </div>
        <span
          className="font-extrabold text-xs tracking-wider uppercase"
          style={{ color: isDarkMode ? '#60a5fa' : theme.textLight }}
        >
          TOPIC: {topicName.replace(/^TOPIC:\s*/i, '')}
        </span>
      </div>

      <span
        className="text-[11px] font-semibold tracking-tight"
        style={{ color: isDarkMode ? '#93c5fd' : theme.textLight }}
      >
        {setInfo}
      </span>
    </div>
  );
}
