import React from 'react';
import { View, ImageBackground, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

interface LyricsBackdropProps {
    coverUrl: string;
    children: React.ReactNode;
}

export function LyricsBackdrop({ coverUrl, children }: LyricsBackdropProps) {
    return (
        <View style={StyleSheet.absoluteFill}>
            <ImageBackground
                source={{ uri: coverUrl }}
                style={StyleSheet.absoluteFill}
                blurRadius={30}
                resizeMode="cover"
            />
            <BlurView
                intensity={40}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                {children}
            </View>
        </View>
    );
}