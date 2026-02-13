import { StyleSheet } from 'react-native-unistyles';
import { lightTheme, darkTheme, type AppTheme } from './themes';
import { breakpoints } from './tokens';

type AppBreakpoints = typeof breakpoints;
type AppThemes = {
  light: AppTheme;
  dark: AppTheme;
};

declare module 'react-native-unistyles' {
  export interface UnistylesBreakpoints extends AppBreakpoints {}
  export interface UnistylesThemes extends AppThemes {}
}

export { lightTheme, darkTheme };
export * from './tokens';
export * from './themes';


StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  breakpoints,
  settings: {
    adaptiveThemes: true,
  },
});
