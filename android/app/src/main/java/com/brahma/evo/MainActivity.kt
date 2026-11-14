package com.brahma.evo

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
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
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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

    private fun requestRuntimePermissions() {
        val needed = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
        }
    }

    inner class BrahmaAndroidBridge {
        @JavascriptInterface
        fun isNativeAndroid(): Boolean = true

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
