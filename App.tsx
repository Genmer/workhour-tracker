import { useState, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { TabBar } from './src/components/TabBar'
import { DashboardScreen } from './src/screens/DashboardScreen'
import { CalendarScreen } from './src/screens/CalendarScreen'
import { HistoryScreen } from './src/screens/HistoryScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { COLORS } from './src/constants'
import { useAppStore } from './src/stores/useAppStore'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const initDatabase = useAppStore((state) => state.initDatabase)

  useEffect(() => {
    void initDatabase()
  }, [initDatabase])

  const renderScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen />
      case 'calendar':
        return <CalendarScreen />
      case 'history':
        return <HistoryScreen />
      case 'settings':
        return <SettingsScreen />
      default:
        return <DashboardScreen />
    }
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {renderScreen()}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <StatusBar style="dark" />
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
})
