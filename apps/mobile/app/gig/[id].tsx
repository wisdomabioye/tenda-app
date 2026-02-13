import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'

export default function GigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <SafeAreaView>
      <View>
        <Text>Gig Detail</Text>
        <Text>{id}</Text>
      </View>
    </SafeAreaView>
  )
}
