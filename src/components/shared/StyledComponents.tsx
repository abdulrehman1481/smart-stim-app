// Shared UI components for consistent styling across the app
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, ScrollView, StyleProp } from 'react-native';
import { theme } from '../../styles/theme';

// Card Component
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({ children, variant = 'elevated', style }) => {
  return (
    <View style={[styles.card, styles[`card_${variant}`], style]}>
      {children}
    </View>
  );
};

// Section Header Component
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  rightElement?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, icon, rightElement }) => {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && <Text style={styles.sectionIcon}>{icon}</Text>}
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement}
    </View>
  );
};

// Button Component
interface ButtonProps {
  onPress: () => void;
  children?: React.ReactNode;
  title?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  title,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon,
  fullWidth = false,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[`button_${variant}`],
        styles[`button_${size}`],
        disabled && styles.button_disabled,
        fullWidth && styles.button_fullWidth,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {children ? (
        typeof children === 'string' ? (
          <Text style={[
            styles.buttonText,
            (variant === 'outline' || variant === 'ghost') && styles[`buttonText_${variant}`],
            disabled && styles.buttonText_disabled
          ]}>
            {children}
          </Text>
        ) : (
          children
        )
      ) : (
        <>
          {icon && <Text style={styles.buttonIcon}>{icon}</Text>}
          <Text style={[
            styles.buttonText,
            (variant === 'outline' || variant === 'ghost') && styles[`buttonText_${variant}`],
            disabled && styles.buttonText_disabled
          ]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// Stats Card Component
interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  unit?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ label, value, icon, color, unit }) => {
  return (
    <View style={[styles.statsCard, color && { borderLeftColor: color }]}>
      {icon && <Text style={styles.statsIcon}>{icon}</Text>}
      <View style={styles.statsContent}>
        <Text style={styles.statsLabel}>{label}</Text>
        <View style={styles.statsValueContainer}>
          <Text style={[styles.statsValue, color && { color }]}>{value}</Text>
          {unit && <Text style={styles.statsUnit}>{unit}</Text>}
        </View>
      </View>
    </View>
  );
};

// Badge Component
interface BadgeProps {
  text: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  style?: StyleProp<ViewStyle>;
}

export const Badge: React.FC<BadgeProps> = ({ text, variant = 'default', style }) => {
  return (
    <View style={[styles.badge, styles[`badge_${variant}`], style]}>
      <Text style={[styles.badgeText, styles[`badgeText_${variant}`]]}>{text}</Text>
    </View>
  );
};

// Info Row Component
interface InfoRowProps {
  label: string;
  value: string | number;
  icon?: string;
}

export const InfoRow: React.FC<InfoRowProps> = ({ label, value, icon }) => {
  return (
    <View style={styles.infoRow}>
      {icon && <Text style={styles.infoIcon}>{icon}</Text>}
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
};

// Screen Container Component
interface ScreenContainerProps {
  children: React.ReactNode;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children }) => {
  return (
    <ScrollView
      style={styles.screenContainer}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // Card Styles
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.md,
  },
  card_default: {},
  card_elevated: {
    ...theme.shadows.md,
  },
  card_outlined: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  // Section Header Styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: theme.spacing.sm,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  sectionSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // Button Styles
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.sm,
  },
  button_primary: {
    backgroundColor: theme.colors.primary,
  },
  button_secondary: {
    backgroundColor: theme.colors.secondary,
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  button_ghost: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  button_danger: {
    backgroundColor: theme.colors.error,
  },
  button_sm: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  button_md: {},
  button_lg: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.base,
  },
  button_disabled: {
    backgroundColor: theme.colors.borderLight,
    opacity: 0.5,
  },
  button_fullWidth: {
    width: '100%',
  },
  buttonIcon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
  },
  buttonText: {
    ...theme.typography.button,
    color: theme.colors.textInverse,
  },
  buttonText_outline: {
    color: theme.colors.primary,
  },
  buttonText_ghost: {
    color: theme.colors.primary,
  },
  buttonText_disabled: {
    color: theme.colors.textLight,
  },

  // Stats Card Styles
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  statsIcon: {
    fontSize: 32,
    marginRight: theme.spacing.md,
  },
  statsContent: {
    flex: 1,
  },
  statsLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statsValue: {
    ...theme.typography.h2,
    color: theme.colors.text,
    fontWeight: '700',
  },
  statsUnit: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },

  // Badge Styles
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start',
  },
  badge_default: {
    backgroundColor: theme.colors.borderLight,
  },
  badge_success: {
    backgroundColor: `${theme.colors.success}20`,
  },
  badge_warning: {
    backgroundColor: `${theme.colors.warning}20`,
  },
  badge_error: {
    backgroundColor: `${theme.colors.error}20`,
  },
  badge_info: {
    backgroundColor: `${theme.colors.info}20`,
  },
  badgeText: {
    ...theme.typography.caption,
    fontWeight: '600',
  },
  badgeText_default: {
    color: theme.colors.textSecondary,
  },
  badgeText_success: {
    color: theme.colors.success,
  },
  badgeText_warning: {
    color: theme.colors.warning,
  },
  badgeText_error: {
    color: theme.colors.error,
  },
  badgeText_info: {
    color: theme.colors.info,
  },

  // Info Row Styles
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  infoIcon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
  },
  infoLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '600',
  },

  // Screen Container Styles
  screenContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screenContent: {
    padding: theme.spacing.base,
    paddingBottom: theme.spacing['2xl'],
  },
});
