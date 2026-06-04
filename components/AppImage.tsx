import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage, ImageProps } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { withUniwind } from "uniwind";

const StyledExpoImage = withUniwind(ExpoImage);

const PLACEHOLDER_IMAGE = require("@/assets/images/icon.png");

export type AppImageVariant = "album" | "artist" | "playlist";

const VARIANT_ICONS: Record<
  AppImageVariant,
  keyof typeof Ionicons.glyphMap
> = {
  album: "musical-notes",
  artist: "person",
  playlist: "albums-outline",
};

function resolveUri(
  uri?: string | null,
  source?: ImageProps["source"],
): string | null {
  if (uri !== undefined) return uri || null;
  if (typeof source === "string") return source || null;
  if (
    source &&
    typeof source === "object" &&
    !Array.isArray(source) &&
    "uri" in source
  ) {
    return source.uri ?? null;
  }
  return null;
}

export type AppImageProps = ImageProps & {
  uri?: string | null;
  variant?: AppImageVariant;
};

export function AppImage({
  uri,
  source,
  variant = "album",
  className,
  style,
  onError,
  contentFit = "cover",
  transition = 200,
  ...rest
}: AppImageProps) {
  const resolvedUri = useMemo(() => resolveUri(uri, source), [uri, source]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedUri]);

  if (typeof source === "number") {
    return (
      <StyledExpoImage
        source={source}
        className={className}
        style={style}
        contentFit={contentFit}
        transition={transition}
        {...rest}
      />
    );
  }

  if (!resolvedUri || failed) {
    return (
      <View
        className={`bg-white/10 items-center justify-center ${className ?? ""}`}
        style={style}
      >
        <Ionicons
          name={VARIANT_ICONS[variant]}
          size={40}
          color="rgba(255,255,255,0.35)"
        />
      </View>
    );
  }

  return (
    <StyledExpoImage
      source={{ uri: resolvedUri }}
      className={className}
      style={style}
      contentFit={contentFit}
      placeholder={PLACEHOLDER_IMAGE}
      placeholderContentFit={contentFit}
      transition={transition}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
