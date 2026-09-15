import { LoadingView } from "@/components/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { Button } from "heroui-native";
import { ScrollView, Text, View } from "react-native";
import { getAppUrl } from "@/lib/env";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Index() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [checkingConnection, setCheckingConnection] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!token) {
      setCheckingConnection(false);
      return;
    }

    let cancelled = false;
    setCheckingConnection(true);

    const checkConnection = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      try {
        await fetch(getAppUrl(), {
          method: "HEAD",
          signal: controller.signal,
        });
        if (!cancelled) router.replace("/(tabs)/home");
      } catch {
        if (!cancelled) router.replace("/downloads");
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setCheckingConnection(false);
      }
    };

    void checkConnection();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (token && (isLoading || checkingConnection)) {
    return <LoadingView />;
  }

  if (token) {
    return null;
  }

  if (isLoading) {
    return <LoadingView />;
  }

  const features = [
    {
      icon: "musical-notes-outline",
      title: "Synchronized Lyrics",
      description:
        "Real-time synchronized lyrics that highlight as the song plays.",
    },
    {
      icon: "search-outline",
      title: "Discover Music",
      description:
        "Explore thousands of Myanmar songs, from traditional to modern hits.",
    },
    {
      icon: "heart-outline",
      title: "Create Playlists",
      description: "Build your personal music collection for every mood.",
    },
    {
      icon: "headset-outline",
      title: "High Quality Audio",
      description: "Enjoy crystal-clear audio streaming optimized for mobile.",
    },
  ];

  const stats = [
    { value: "10K+", label: "Songs" },
    { value: "500+", label: "Artists" },
    { value: "50+", label: "Genres" },
    { value: "25K+", label: "Listeners" },
  ];

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      className="flex-1 bg-background"
    >
      <ScrollView className="flex-1 pt-10" contentContainerClassName="pb-10">
        {/* Hero Section */}
        <View className="px-6 pt-5 pb-12 items-center">
          <View className="bg-primary/10 px-4 py-2 rounded-full border border-primary/20 mb-6 flex-row items-center">
            <Ionicons name="sparkles" size={16} color="#ff0000" />
            <Text className="text-primary text-xs font-bold ml-2 uppercase tracking-wider">
              Myanmar&apos;s Premier Music Platform
            </Text>
          </View>

          <Text className="text-4xl md:text-5xl font-bold text-center text-foreground leading-loose">
            Discover Myanmar&apos;s{"\n"}
            <Text className="text-primary">Musical Heritage</Text>
          </Text>

          <Text className="text-muted-foreground text-center text-lg mt-6 leading-relaxed px-4">
            Stream thousands of Myanmar songs with real-time synchronized
            lyrics. Experience traditional melodies and modern beats.
          </Text>

          <View className="flex-row gap-4 mt-10 w-full">
            <Link href="/(auth)/login" asChild>
              <Button variant="primary" size="lg" className="flex-1 rounded-sm">
                <Ionicons name="play" size={20} color="white" />
                <Button.Label className="font-bold ml-2">
                  Start Listening
                </Button.Label>
              </Button>
            </Link>
          </View>
        </View>

        {/* Stats Section */}
        <View className="flex-row flex-wrap px-4 py-8 bg-card/30">
          {stats.map((stat, index) => (
            <View key={index} className="w-1/2 p-4 items-center">
              <Text className="text-2xl font-bold text-primary">
                {stat.value}
              </Text>
              <Text className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Features Section */}
        <View className="px-6 py-16">
          <Text className="text-3xl font-bold text-foreground text-center mb-4">
            Everything You Need
          </Text>
          <Text className="text-muted-foreground text-center mb-12 px-4">
            Powerful features designed to enhance your music experience
          </Text>

          <View className="gap-6">
            {features.map((feature, index) => (
              <View
                key={index}
                className="p-6 rounded-2xl bg-card border border-border"
              >
                <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center mb-4">
                  <Ionicons
                    name={feature.icon as any}
                    size={24}
                    color="#ff0000"
                  />
                </View>
                <Text className="text-xl font-bold text-foreground mb-2">
                  {feature.title}
                </Text>
                <Text className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* How It Works */}
        <View className="px-6 py-16 bg-card/30">
          <Text className="text-3xl font-bold text-foreground text-center mb-12">
            How It Works
          </Text>

          <View className="gap-12">
            {[
              {
                step: "01",
                title: "Sign Up Free",
                desc: "Create your account in seconds.",
              },
              {
                step: "02",
                title: "Explore Music",
                desc: "Browse genres and discover artists.",
              },
              {
                step: "03",
                title: "Start Listening",
                desc: "Play songs with synchronized lyrics.",
              },
            ].map((item, index) => (
              <View key={index} className="items-center">
                <Text className="text-5xl font-bold text-primary/20 mb-2">
                  {item.step}
                </Text>
                <Text className="text-xl font-bold text-foreground mb-1">
                  {item.title}
                </Text>
                <Text className="text-muted-foreground text-center">
                  {item.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Final CTA */}
        <View className="px-6 py-20 items-center">
          <Text className="text-3xl font-bold text-foreground text-center mb-4">
            Ready to Listen?
          </Text>
          <Text className="text-muted-foreground text-center mb-10 px-8">
            Join thousands of users enjoying Myanmar music on Myanify.
          </Text>
          <Link href="/(auth)/login" asChild>
            <Button className="w-full rounded-sm bg-primary h-14">
              <Button.Label className="text-primary-foreground font-bold">
                Get Started Now
              </Button.Label>
            </Button>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}
