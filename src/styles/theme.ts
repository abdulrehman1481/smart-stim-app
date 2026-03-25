// Shared theme and styling constants for the entire app
export const theme = {
  // Color Palette
  colors: {
    primary: '#6366f1',
    primaryDark: '#4f46e5',
    primaryLight: '#818cf8',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    background: '#f8fafc',
    surface: '#ffffff',
    card: '#ffffff',
    
    text: '#1e293b',
    textSecondary: '#64748b',
    textLight: '#94a3b8',
    textInverse: '#ffffff',
    
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    
    overlay: 'rgba(0, 0, 0, 0.5)',
    
    // Sensor-specific colors
    temperature: '#f97316',
    ppg: '#ef4444',
    imu: '#3b82f6',
    eda: '#8b5cf6',
    flash: '#6366f1',
    
    // Sensor subsystem colors
    sensors: {
      accel: '#3b82f6',
      gyro: '#8b5cf6',
      temp: '#f97316',
      heart: '#ef4444',
      eda: '#10b981',
    },
  },
  
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
  },
  
  // Border Radius
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  
  // Typography
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '800' as const,
      lineHeight: 40,
    },
    h2: {
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    h4: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
    button: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
  },
  
  // Shadows
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

// Helper functions for consistent styling
export const createCardStyle = (variant: 'default' | 'elevated' | 'outlined' = 'default') => ({
  backgroundColor: theme.colors.card,
  borderRadius: theme.borderRadius.lg,
  padding: theme.spacing.base,
  ...(variant === 'elevated' ? theme.shadows.md : {}),
  ...(variant === 'outlined' ? {
    borderWidth: 1,
    borderColor: theme.colors.border,
  } : {}),
});

export const createButtonStyle = (
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md'
) => {
  const sizeStyles = {
    sm: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: 14,
    },
    md: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      fontSize: 16,
    },
    lg: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.base,
      fontSize: 18,
    },
  };

  const baseStyle = {
    borderRadius: theme.borderRadius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    ...sizeStyles[size],
  };

  switch (variant) {
    case 'primary':
      return {
        ...baseStyle,
        backgroundColor: theme.colors.primary,
      };
    case 'secondary':
      return {
        ...baseStyle,
        backgroundColor: theme.colors.secondary,
      };
    case 'outline':
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.primary,
      };
    case 'ghost':
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
      };
    default:
      return baseStyle;
  }
};

export const createInputStyle = () => ({
  backgroundColor: theme.colors.surface,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: theme.borderRadius.md,
  paddingHorizontal: theme.spacing.base,
  paddingVertical: theme.spacing.md,
  fontSize: 16,
  color: theme.colors.text,
});

export const createSectionHeaderStyle = () => ({
  fontSize: 18,
  fontWeight: '600' as const,
  color: theme.colors.text,
  marginBottom: theme.spacing.md,
  marginTop: theme.spacing.base,
});

export const getStatusColor = (status: 'success' | 'warning' | 'error' | 'info') => {
  switch (status) {
    case 'success':
      return theme.colors.success;
    case 'warning':
      return theme.colors.warning;
    case 'error':
      return theme.colors.error;
    case 'info':
      return theme.colors.info;
    default:
      return theme.colors.text;
  }
};
