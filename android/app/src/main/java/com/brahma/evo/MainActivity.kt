package com.brahma.evo

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File
import java.util.Locale

class MainActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    private lateinit var webView: WebView
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        tts = TextToSpeech(this, this)
        requestRuntimePermissions()

        webView = WebView(this)
        setContentView(webView)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.PathHandler { rawPath ->
                val cleanPath = rawPath.trimStart('/').ifEmpty { "index.html" }
                val assetPath = if (cleanPath.startsWith("public/")) cleanPath else "public/$cleanPath"
                try {
                    val mime = when {
                        assetPath.endsWith(".html") -> "text/html"
                        assetPath.endsWith(".js") || assetPath.endsWith(".mjs") -> "application/javascript"
                        assetPath.endsWith(".css") -> "text/css"
                        assetPath.endsWith(".json") || assetPath.endsWith(".webmanifest") -> "application/json"
                        assetPath.endsWith(".png") -> "image/png"
                        assetPath.endsWith(".svg") -> "image/svg+xml"
                        assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg") -> "image/jpeg"
                        assetPath.endsWith(".woff2") -> "font/woff2"
                        else -> "application/octet-stream"
                    }
                    WebResourceResponse(mime, "UTF-8", assets.open(assetPath))
                } catch (_: Exception) {
                    null
                }
            })
            .build()

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.databaseEnabled = true

        webView.addJavascriptInterface(BrahmaAndroidBridge(), "BrahmaNative")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url ?: return null
                return assetLoader.shouldInterceptRequest(url)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { request.grant(request.resources) }
            }
        }

        val serverUrl = intent.getStringExtra("server_url")
        if (!serverUrl.isNullOrBlank()) {
            webView.loadUrl(serverUrl)
        } else {
            webView.loadUrl("https://appassets.androidplatform.net/index.html")
        }
    }

    override fun onInit(status: Int) {
        ttsReady = (status == TextToSpeech.SUCCESS)
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }

    private fun requestRuntimePermissions() {
        val needed = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
            needed.add(Manifest.permission.READ_MEDIA_IMAGES)
        } else {
            needed.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
        }
    }

    private fun isTermuxInstalled(): Boolean {
        return try {
            packageManager.getPackageInfo("com.termux", 0)
            true
        } catch (_: Exception) {
            false
        }
    }

    inner class BrahmaAndroidBridge {
        @JavascriptInterface
        fun isNativeAndroid(): Boolean = true

        @JavascriptInterface
        fun getPermissionStatusJson(): String {
            val mic = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
            val cam = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            val overlay = Settings.canDrawOverlays(this@MainActivity)
            val accessibility = BrahmaAccessibilityService.isServiceEnabled(this@MainActivity)
            val notifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            } else {
                NotificationManagerCompat.from(this@MainActivity).areNotificationsEnabled()
            }
            val installPackages = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                packageManager.canRequestPackageInstalls()
            } else {
                true
            }
            val storage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
            } else {
                ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
            }
            return JSONObject().apply {
                put("microphone", mic)
                put("camera", cam)
                put("overlay", overlay)
                put("accessibility", accessibility)
                put("notifications", notifications)
                put("installPackages", installPackages)
                put("storage", storage)
                put("termuxInstalled", isTermuxInstalled())
            }.toString()
        }

        @JavascriptInterface
        fun requestAllRuntimePermissions() {
            runOnUiThread { requestRuntimePermissions() }
        }

        @JavascriptInterface
        fun requestSinglePermission(key: String) {
            runOnUiThread {
                when (key) {
                    "microphone" -> ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(Manifest.permission.RECORD_AUDIO),
                        1002
                    )
                    "camera" -> ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(Manifest.permission.CAMERA),
                        1003
                    )
                    "accessibility" -> startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                    "overlay" -> startSystemOverlay()
                    "notifications" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                                putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                            }
                            startActivity(intent)
                        }
                    }
                    "installPackages" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            val intent = Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:$packageName")
                            )
                            startActivity(intent)
                        }
                    }
                    "storage" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            ActivityCompat.requestPermissions(
                                this@MainActivity,
                                arrayOf(Manifest.permission.READ_MEDIA_IMAGES),
                                1004
                            )
                        } else {
                            ActivityCompat.requestPermissions(
                                this@MainActivity,
                                arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE),
                                1004
                            )
                        }
                    }
                    "termux" -> {
                        val launch = packageManager.getLaunchIntentForPackage("com.termux")
                        if (launch != null) {
                            startActivity(launch)
                        } else {
                            val appSettings = Intent(
                                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.parse("package:$packageName")
                            )
                            startActivity(appSettings)
                        }
                    }
                }
            }
        }

        @JavascriptInterface
        fun openAccessibilitySettings() {
            runOnUiThread {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }

        @JavascriptInterface
        fun startSystemOverlay() {
            runOnUiThread {
                if (!Settings.canDrawOverlays(this@MainActivity)) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivity(intent)
                    return@runOnUiThread
                }
                val svc = Intent(this@MainActivity, BrahmaOverlayService::class.java)
                ContextCompat.startForegroundService(this@MainActivity, svc)
            }
        }

        @JavascriptInterface
        fun stopSystemOverlay() {
            stopService(Intent(this@MainActivity, BrahmaOverlayService::class.java))
        }

        @JavascriptInterface
        fun updateOverlayState(state: String, voiceLevel: Float, lookX: Float, lookY: Float) {
            BrahmaOverlayService.currentOrbState = state
            BrahmaOverlayService.currentVoiceLevel = voiceLevel.coerceIn(0f, 1f)
            BrahmaOverlayService.targetLookX = lookX.coerceIn(-1f, 1f)
            BrahmaOverlayService.targetLookY = lookY.coerceIn(-1f, 1f)
        }

        @JavascriptInterface
        fun updateOverlayMood(mood: String) {
            BrahmaOverlayService.currentMood = mood
        }

        @JavascriptInterface
        fun speakDeepVoice(text: String, lang: String, pitch: Float, rate: Float): Boolean {
            val engine = tts ?: return false
            if (!ttsReady) return false
            return try {
                val locale = Locale.forLanguageTag(lang)
                engine.language = locale
                engine.setPitch(pitch.coerceIn(0.45f, 1.5f))
                engine.setSpeechRate(rate.coerceIn(0.5f, 1.5f))
                engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "brahma-${System.currentTimeMillis()}")
                true
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun stopNativeVoice() {
            tts?.stop()
        }

        @JavascriptInterface
        fun performAccessibilityAction(action: String): Boolean {
            val svc = BrahmaAccessibilityService.instance ?: return false
            return svc.executeGlobalCommand(action)
        }

        @JavascriptInterface
        fun clickTextOnScreen(text: String): Boolean {
            val svc = BrahmaAccessibilityService.instance ?: return false
            return svc.clickNodeByText(text)
        }

        @JavascriptInterface
        fun openAppByName(appName: String): Boolean {
            return try {
                val q = appName.trim().lowercase(Locale.ROOT)
                val mainIntent = Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_LAUNCHER)
                }
                val apps = packageManager.queryIntentActivities(mainIntent, 0)
                val match = apps.firstOrNull { info ->
                    val label = info.loadLabel(packageManager).toString().lowercase(Locale.ROOT)
                    val pkg = info.activityInfo.packageName.lowercase(Locale.ROOT)
                    label.contains(q) || pkg.contains(q)
                } ?: return false
                val launch = packageManager.getLaunchIntentForPackage(match.activityInfo.packageName) ?: return false
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(launch)
                true
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun runInTermux(command: String): Boolean {
            return try {
                val intent = Intent("com.termux.RUN_COMMAND").apply {
                    setClassName("com.termux", "com.termux.app.RunCommandService")
                    putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash")
                    putExtra("com.termux.RUN_COMMAND_ARGUMENTS", arrayOf("-lc", command))
                    putExtra("com.termux.RUN_COMMAND_BACKGROUND", false)
                }
                startService(intent)
                true
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun installApkFile(fileName: String): Boolean {
            return try {
                val apkFile = File(getExternalFilesDir(null), fileName)
                if (!apkFile.exists()) return false
                val uri = FileProvider.getUriForFile(
                    this@MainActivity,
                    "$packageName.fileprovider",
                    apkFile
                )
                val installIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
                }
                startActivity(installIntent)
                true
            } catch (_: Exception) {
                false
            }
        }
    }
}
