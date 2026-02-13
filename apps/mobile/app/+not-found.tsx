import { View, Text } from 'react-native'
import { Link, Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <SafeAreaView>
        <View>
          <Text>404</Text>
          <Text>This page doesn't exist.</Text>
          <Link href="/">
            <Text>Go home</Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  )
}
