package com.brahma.evo

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import kotlin.math.cos
import kotlin.math.sin

class BrahmaOverlayService : Service() {

    companion object {
        @Volatile var currentOrbState: String = "ONLINE"
        @Volatile var currentVoiceLevel: Float = 0.08f
        @Volatile var targetLookX: Float = 0f
        @Volatile var targetLookY: Float = 0f
        @Volatile var currentMood: String = "neutral"
    }

    private lateinit var windowManager: WindowManager
    private lateinit var notchView: DynamicNotchView
    private val handler = Handler(Looper.getMainLooper())
    private var tick = 0f

    private val ticker = object : Runnable {
        override fun run() {
            tick += if (currentMood == "dizzy") 0.34f else 0.16f
            if (::notchView.isInitialized) {
                notchView.invalidate()
            }
            handler.postDelayed(this, 33L)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundNotification()

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        notchView = DynamicNotchView(this)

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            dp(220),
            dp(42),
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = dp(8)
        }

        windowManager.addView(notchView, params)
        handler.post(ticker)
    }

    override fun onDestroy() {
        handler.removeCallbacks(ticker)
        if (::notchView.isInitialized) {
            windowManager.removeView(notchView)
        }
        super.onDestroy()
    }

    private fun startForegroundNotification() {
        val channelId = "brahma_notch_overlay"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Brahma Dynamic Notch",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Brahma AI Evo Active")
            .setContentText("Dynamic Notch eye & voice overlay running")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
        startForeground(42, notification)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    inner class DynamicNotchView(context: Context) : View(context) {
        private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#050608") }
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#3300E5FF")
            style = Paint.Style.STROKE
            strokeWidth = 2f
        }
        private val eyeSocketPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#111827") }
        private val pupilPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#00E5FF") }
        private val spiralPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#F59E0B")
            style = Paint.Style.STROKE
            strokeWidth = 2.5f
        }
        private val browPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#E2E8F0")
            strokeWidth = 3f
            strokeCap = Paint.Cap.ROUND
        }
        private val dotColors = intArrayOf(
            Color.parseColor("#00E5FF"),
            Color.parseColor("#10B981"),
            Color.parseColor("#F59E0B"),
            Color.parseColor("#8B5CF6"),
            Color.parseColor("#F43F5E"),
            Color.parseColor("#38BDF8"),
            Color.parseColor("#A3E635")
        )
        private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG)

        override fun onTouchEvent(event: MotionEvent): Boolean {
            if (event.action == MotionEvent.ACTION_DOWN) {
                val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                if (launch != null) startActivity(launch)
                return true
            }
            return super.onTouchEvent(event)
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val mood = currentMood
            borderPaint.color = when (mood) {
                "angry" -> Color.parseColor("#AAEF4444")
                "sad" -> Color.parseColor("#AA60A5FA")
                "dizzy" -> Color.parseColor("#CCF59E0B")
                else -> Color.parseColor("#4400E5FF")
            }
            pupilPaint.color = when (mood) {
                "angry" -> Color.parseColor("#F43F5E")
                "sad" -> Color.parseColor("#60A5FA")
                "dizzy" -> Color.parseColor("#F59E0B")
                else -> Color.parseColor("#00E5FF")
            }

            val rect = RectF(2f, 2f, width - 2f, height - 2f)
            val radius = height / 2f
            canvas.drawRoundRect(rect, radius, radius, bgPaint)
            canvas.drawRoundRect(rect, radius, radius, borderPaint)

            val eyeY = height * 0.56f
            val leftEyeX = width * 0.24f
            val rightEyeX = width * 0.36f
            val eyeRadius = height * 0.19f
            val pupilOffsetX = targetLookX * (eyeRadius * 0.45f)
            val pupilOffsetY = targetLookY * (eyeRadius * 0.45f)

            // Mood-expressive eyebrows
            val browY = height * 0.27f - (currentVoiceLevel * 4f)
            when (mood) {
                "angry" -> {
                    canvas.drawLine(leftEyeX - eyeRadius, browY - 2f, leftEyeX + eyeRadius, browY + 3f, browPaint)
                    canvas.drawLine(rightEyeX - eyeRadius, browY + 3f, rightEyeX + eyeRadius, browY - 2f, browPaint)
                }
                "sad" -> {
                    canvas.drawLine(leftEyeX - eyeRadius, browY + 3f, leftEyeX + eyeRadius, browY - 2f, browPaint)
                    canvas.drawLine(rightEyeX - eyeRadius, browY - 2f, rightEyeX + eyeRadius, browY + 3f, browPaint)
                }
                else -> {
                    canvas.drawLine(leftEyeX - eyeRadius, browY + 1f, leftEyeX + eyeRadius, browY - 1f, browPaint)
                    canvas.drawLine(rightEyeX - eyeRadius, browY - 1f, rightEyeX + eyeRadius, browY + 1f, browPaint)
                }
            }

            // Eyes + mood pupils
            canvas.drawCircle(leftEyeX, eyeY, eyeRadius, eyeSocketPaint)
            canvas.drawCircle(rightEyeX, eyeY, eyeRadius, eyeSocketPaint)

            if (mood == "dizzy") {
                val spinX = cos(tick * 2.4f) * (eyeRadius * 0.35f)
                val spinY = sin(tick * 2.4f) * (eyeRadius * 0.35f)
                canvas.drawCircle(leftEyeX, eyeY, eyeRadius * 0.65f, spiralPaint)
                canvas.drawCircle(rightEyeX, eyeY, eyeRadius * 0.65f, spiralPaint)
                canvas.drawCircle(leftEyeX + spinX, eyeY + spinY, eyeRadius * 0.28f, pupilPaint)
                canvas.drawCircle(rightEyeX - spinX, eyeY - spinY, eyeRadius * 0.28f, pupilPaint)
            } else {
                canvas.drawCircle(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY, eyeRadius * 0.52f, pupilPaint)
                canvas.drawCircle(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY, eyeRadius * 0.52f, pupilPaint)
            }

            // Multi-color dot-matrix equalizer beside the eyes
            val startX = width * 0.50f
            val colSpacing = width * 0.06f
            val baseY = height * 0.72f
            val rowSpacing = height * 0.14f

            for (c in 0 until 7) {
                dotPaint.color = dotColors[c]
                val wave = ((sin(tick + c * 0.85f) + 1f) * 0.5f) * (0.25f + currentVoiceLevel * 0.9f)
                val litRows = (1 + (wave * 3.2f).toInt()).coerceIn(1, 4)
                for (r in 0 until 4) {
                    dotPaint.alpha = if (r < litRows) 255 else 45
                    val cx = startX + c * colSpacing
                    val cy = baseY - r * rowSpacing
                    canvas.drawCircle(cx, cy, height * 0.045f, dotPaint)
                }
            }
        }
    }
}
