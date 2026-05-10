package com.example.traffigo.utils;

import android.content.Context;
import android.content.SharedPreferences;

public class AppearanceHelper {
    private static final String PREF_NAME = "AppCustomizePrefs";
    private static final String KEY_BG = "custom_background";
    private static final String KEY_CARD_COLOR = "custom_card_color";
    private static final String KEY_TEXT_COLOR = "custom_text_color";

    // Lưu và lấy Ảnh nền
    public static void saveCustomBackground(Context context, int resId) {
        SharedPreferences.Editor editor = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit();
        editor.putInt(KEY_BG, resId);
        editor.apply();
    }

    public static int getCustomBackground(Context context, int defaultResId) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getInt(KEY_BG, defaultResId);
    }

    // Lưu và lấy Màu thẻ (Card)
    public static void saveCustomCardColor(Context context, String hexColor) {
        SharedPreferences.Editor editor = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit();
        editor.putString(KEY_CARD_COLOR, hexColor);
        editor.apply();
    }

    public static String getCustomCardColor(Context context, String defaultHexColor) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_CARD_COLOR, defaultHexColor);
    }

    // Lưu và lấy Màu chữ
    public static void saveCustomTextColor(Context context, String hexColor) {
        SharedPreferences.Editor editor = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit();
        editor.putString(KEY_TEXT_COLOR, hexColor);
        editor.apply();
    }

    public static String getCustomTextColor(Context context, String defaultHexColor) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_TEXT_COLOR, defaultHexColor);
    }
}