import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import Updater from '../components/Updater';

export default function RootLayout() {
  return (
    <>
      <StatusBar hidden />
      <Updater />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: Colors.background,
          },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(drawer)" />
        <Stack.Screen
          name="player/[id]"
          options={{
            animation: 'fade',
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="media-player/[id]"
          options={{
            animation: 'fade',
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="media/[id]"
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="series/[id]"
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="category/[id]"
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="actor/[id]"
          options={{ animation: 'fade' }}
        />
      </Stack>
    </>
  );
}
