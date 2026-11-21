# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Exsy: keep Capacitor and its plugins (they are found by name from JavaScript)
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class io.capawesome.capacitorjs.plugins.firebase.authentication.** { *; }
-keepattributes *Annotation*, JavascriptInterface
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
# the sign-in plugin can also do Facebook login, which Exsy does not include
-dontwarn com.facebook.**
