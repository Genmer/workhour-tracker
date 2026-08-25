import { StyleSheet, View, TouchableOpacity, Text } from 'react-native'
import { COLORS } from '../constants'

interface TabBarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: 'dashboard', label: '首页', icon: '🏠' },
  { id: 'calendar', label: '日历', icon: '📅' },
  { id: 'history', label: '历史', icon: '📜' },
  { id: 'settings', label: '设置', icon: '⚙️' },
]

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={styles.tab}
          onPress={() => onTabChange(tab.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.icon}>{tab.icon}</Text>
          <Text
            style={[
              styles.label,
              activeTab === tab.id && styles.labelActive,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.separator,
    paddingBottom: 20,
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  icon: {
    fontSize: 24,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  labelActive: {
    color: COLORS.success,
    fontWeight: '600',
  },
})
