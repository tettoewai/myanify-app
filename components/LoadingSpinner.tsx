import { Spinner } from "heroui-native";
import { View, type ViewProps } from "react-native";

export const LOADING_SPINNER_COLOR = "#ff0000";

export type LoadingSpinnerSize = "sm" | "md" | "lg";

type LoadingSpinnerProps = {
  size?: LoadingSpinnerSize;
  /** Spinner stroke color. Defaults to brand primary. */
  color?: string;
};

/** Inline loading indicator — use inside buttons, rows, or overlays. */
export function LoadingSpinner({
  size = "md",
  color = LOADING_SPINNER_COLOR,
}: LoadingSpinnerProps) {
  return <Spinner size={size} color={color} />;
}

type LoadingViewProps = ViewProps & {
  size?: LoadingSpinnerSize;
  color?: string;
  className?: string;
};

/** Full-area centered loading state for screens and sections. */
export function LoadingView({
  size = "lg",
  color = LOADING_SPINNER_COLOR,
  className = "flex-1 bg-background justify-center items-center",
  ...props
}: LoadingViewProps) {
  return (
    <View className={className} {...props}>
      <LoadingSpinner size={size} color={color} />
    </View>
  );
}
