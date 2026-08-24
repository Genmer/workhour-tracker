import { useState, useEffect } from 'react'
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native'
import { COLORS } from '../constants'
import { GitLiteStatus } from '../stores/useAppStore'

interface GitLiteAuthModalProps {
  visible: boolean
  currentStatus: GitLiteStatus
  onClose: () => void
  onConnect: (provider: 'github' | 'gitee' | 'memory', token?: string) => Promise<void>
}

export function GitLiteAuthModal({
  visible,
  currentStatus,
  onClose,
  onConnect,
}: GitLiteAuthModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'gitee' | 'memory'>(
    currentStatus.provider.startsWith('gitee')
      ? 'gitee'
      : currentStatus.provider.startsWith('memory')
      ? 'memory'
      : 'github'
  )
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setSelectedProvider(
        currentStatus.provider.startsWith('gitee')
          ? 'gitee'
          : currentStatus.provider.startsWith('memory')
          ? 'memory'
          : 'github'
      )
      setErrorMsg(null)
      setSuccessMsg(null)
    }
  }, [visible, currentStatus])

  const handleOpenTokenHelp = () => {
    if (selectedProvider === 'github') {
      void Linking.openURL('https://github.com/settings/tokens/new?description=GitLite-WorkHourTracker&scopes=repo')
    } else if (selectedProvider === 'gitee') {
      void Linking.openURL('https://gitee.com/profile/personal_access_tokens/new')
    }
  }

  const handleSaveAndConnect = async () => {
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      if (selectedProvider !== 'memory' && !token.trim()) {
        setErrorMsg(`请输入 ${selectedProvider === 'github' ? 'GitHub' : 'Gitee'} 的访问令牌 (Token)`)
        setLoading(false)
        return
      }

      await onConnect(selectedProvider, token.trim() || undefined)
      setSuccessMsg(`已成功连接至 ${selectedProvider.toUpperCase()} 云端仓库！`)
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err: any) {
      setErrorMsg(err?.message || '连接失败，请检查 Token 权限或网络')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchToMemory = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      await onConnect('memory')
      setSuccessMsg('已切换至本地纯内存离线模式')
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err: any) {
      setErrorMsg(err?.message || '切换失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.header}>
              <Text style={styles.title}>GitLite 云端连接配置</Text>
              <Text style={styles.subtitle}>Local-First 嵌入式数据库 · 原生连通 Git 仓库</Text>
            </View>

            {/* 平台选择 */}
            <View style={styles.platformSelector}>
              <TouchableOpacity
                style={[
                  styles.platformTab,
                  selectedProvider === 'github' && styles.platformTabActive,
                ]}
                onPress={() => {
                  setSelectedProvider('github')
                  setErrorMsg(null)
                }}
              >
                <Text style={styles.platformIcon}>🐙</Text>
                <Text
                  style={[
                    styles.platformText,
                    selectedProvider === 'github' && styles.platformTextActive,
                  ]}
                >
                  GitHub
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.platformTab,
                  selectedProvider === 'gitee' && styles.platformTabActive,
                ]}
                onPress={() => {
                  setSelectedProvider('gitee')
                  setErrorMsg(null)
                }}
              >
                <Text style={styles.platformIcon}>🔴</Text>
                <Text
                  style={[
                    styles.platformText,
                    selectedProvider === 'gitee' && styles.platformTextActive,
                  ]}
                >
                  Gitee
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.platformTab,
                  selectedProvider === 'memory' && styles.platformTabActive,
                ]}
                onPress={() => {
                  setSelectedProvider('memory')
                  setErrorMsg(null)
                }}
              >
                <Text style={styles.platformIcon}>💾</Text>
                <Text
                  style={[
                    styles.platformText,
                    selectedProvider === 'memory' && styles.platformTextActive,
                  ]}
                >
                  本地离线
                </Text>
              </TouchableOpacity>
            </View>

            {/* 当前平台信息 */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>存储私有仓</Text>
                <Text style={styles.infoValue}>gitlite-repo (自动建仓)</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>数据分支</Text>
                <Text style={styles.infoValue}>gitlite/workhour-tracker</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>当前状态</Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: currentStatus.isReady ? COLORS.success : COLORS.warning },
                  ]}
                >
                  {currentStatus.isReady ? '🟢 本地镜像已就绪' : '🟡 未连接'}
                </Text>
              </View>
            </View>

            {selectedProvider !== 'memory' ? (
              <View style={styles.inputSection}>
                <View style={styles.inputHeader}>
                  <Text style={styles.inputLabel}>
                    {selectedProvider === 'github' ? 'GitHub' : 'Gitee'} 个人令牌 (PAT)
                  </Text>
                  <TouchableOpacity onPress={handleOpenTokenHelp}>
                    <Text style={styles.tokenHelpLink}>一键获取 Token ↗</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.tokenInput}
                  value={token}
                  onChangeText={setToken}
                  placeholder={
                    selectedProvider === 'github'
                      ? '输入 gh_p... (需勾选 repo 权限)'
                      : '输入 Gitee 私人令牌 (需勾选 projects 权限)'
                  }
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />

                <Text style={styles.securityNote}>
                  🛡️ 安全承诺：Token 仅保存在你的本地设备中，绝不经过任何第三方服务器。
                </Text>
              </View>
            ) : (
              <View style={styles.offlineBox}>
                <Text style={styles.offlineTitle}>纯本地离线模式</Text>
                <Text style={styles.offlineDesc}>
                  所有打卡记录仅保存在当前浏览器的 IndexedDB / LocalStorage 中，不推送到云端 Git 仓库。
                </Text>
              </View>
            )}

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            )}

            {successMsg && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✅ {successMsg}</Text>
              </View>
            )}

            {/* 操作按钮 */}
            <View style={styles.actionButtons}>
              {selectedProvider !== 'memory' ? (
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={handleSaveAndConnect}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.connectBtnText}>🚀 验证并连接云端数据库</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={handleSwitchToMemory}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.connectBtnText}>切换为离线模式</Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
                <Text style={styles.closeBtnText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 1000,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  scroll: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  platformSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  platformTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 4,
  },
  platformTabActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  platformIcon: {
    fontSize: 14,
  },
  platformText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  platformTextActive: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  infoCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.separator,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  tokenHelpLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  tokenInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: COLORS.separator,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'JetBrainsMono-Regular',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  securityNote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  offlineBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  offlineDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  successText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },
  actionButtons: {
    gap: 8,
  },
  connectBtn: {
    height: 44,
    backgroundColor: COLORS.success,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
})
