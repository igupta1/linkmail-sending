'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label="Toggle theme"
    >
      <span className="sr-only">Toggle theme</span>
      <motion.span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform"
        animate={{
          x: theme === 'dark' ? 20 : 4,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30
        }}
      >
        {theme === 'dark' ? (
          <Moon className="h-3 w-3 text-gray-600 m-0.5" />
        ) : (
          <Sun className="h-3 w-3 text-yellow-500 m-0.5" />
        )}
      </motion.span>
    </button>
  );
}
