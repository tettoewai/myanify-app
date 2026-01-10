import { withUniwind } from 'uniwind';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';

export const StyledImage = withUniwind(ExpoImage);
export const StyledSafeAreaView = withUniwind(RNSafeAreaView);
