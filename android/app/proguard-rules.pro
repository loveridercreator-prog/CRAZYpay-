# CrazyPay Android ProGuard rules

# Preserve JavaScriptInterface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepattributes JavascriptInterface
-keepattributes *Annotation*

# Keep CrazyPay package models and bridge
-keep class com.crazypay.app.** { *; }

# WebKit rules
-keep public class android.webkit.** {
    public protected *;
}
