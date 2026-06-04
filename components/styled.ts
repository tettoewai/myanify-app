import { withUniwind } from 'uniwind';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';

export { AppImage, AppImage as StyledImage } from './AppImage';
export const StyledSafeAreaView = withUniwind(RNSafeAreaView);
