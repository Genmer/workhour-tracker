import { StyleSheet, TouchableOpacity, Text } from 'react-native'
import { COLORS } from '../constants'

interface LeaveToggleProps {
  isLeave: boolean
  onPress: () => void
}

export function LeaveToggle({ isLeave, onPress }: LeaveToggleProps) {
  return (
    <TouchableOpacity
      style={[styles.button, isLeave && styles.active]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, isLeave && styles.textActive]}>休</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.separator,
    justifyContent: 'center',
    alignItems: 'center',
  },
  active: {
    backgroundColor: COLORS.leave,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  textActive: {
    color: '#FFFFFF',
  },
})
