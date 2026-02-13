import { View, ActivityIndicator } from 'react-native'

export function LoadingScreen() {
  return (
    <View className="">
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  )
}
