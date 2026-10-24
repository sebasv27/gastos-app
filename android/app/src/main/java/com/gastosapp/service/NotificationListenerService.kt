// src/main/java/com/gastosapp/service/NotificationListenerService.kt
package com.gastosapp.service

import android.app.Notification
import android.app.PendingIntent
import android.content.Intent
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
import com.gastosapp.GastosApp
import com.gastosapp.R
import com.gastosapp.api.ApiClient
import com.gastosapp.api.NotificationPayload
import com.gastosapp.model.PreferencesManager
import com.gastosapp.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.LinkedList

class NotificationListenerService : android.service.notification.NotificationListenerService() {

    private val TAG         = "GastosNotifService"
    private val scope       = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val api         = ApiClient()
    private lateinit var prefs: PreferencesManager

    // Cola de pendientes si no hay red
    private val pendingQueue = LinkedList<NotificationPayload>()
    private val MAX_PENDING  = 100

    override fun onCreate() {
        super.onCreate()
        prefs = PreferencesManager(applicationContext)
        showPersistentNotification()
        Log.i(TAG, "Servicio de monitoreo iniciado")
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    /**
     * Se llama cada vez que llega una notificación nueva al sistema.
     */
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return

        // Solo procesar paquetes bancarios configurados
        if (pkg !in GastosApp.BANK_PACKAGES) return

        val extras = sbn.notification?.extras ?: return
        val title  = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val text   = extras.getString(Notification.EXTRA_TEXT)
            ?: extras.getString(Notification.EXTRA_BIG_TEXT)
            ?: ""

        if (title.isBlank() && text.isBlank()) return

        Log.d(TAG, "Notif bancaria de $pkg: [$title] $text")

        val payload = NotificationPayload(
            appPackage = pkg,
            title      = title,
            text       = text,
            timestamp  = sbn.postTime
        )

        scope.launch {
            sendToBackend(payload)
        }
    }

    private suspend fun sendToBackend(payload: NotificationPayload) {
        val token     = prefs.token.first()
        val serverUrl = prefs.serverUrl.first()

        if (token.isNullOrBlank() || serverUrl.isNullOrBlank()) {
            Log.w(TAG, "Sin configuración — notificación descartada")
            return
        }

        // Primero enviar pendientes de la cola
        if (pendingQueue.isNotEmpty()) {
            val batch = pendingQueue.toList()
            pendingQueue.clear()
            val batchResult = api.sendBatch(serverUrl, token, batch)
            if (!batchResult.success) {
                // Devolver a la cola si falla
                pendingQueue.addAll(batch.takeLast(MAX_PENDING))
            }
        }

        val result = api.sendNotification(serverUrl, token, payload)

        when {
            result.success && !result.ignored ->
                Log.i(TAG, "✅ Transacción registrada: ${payload.title}")
            result.success && result.ignored  ->
                Log.d(TAG, "↩️ Ignorada (no es transacción): ${payload.title}")
            else -> {
                Log.w(TAG, "⚠️ Error enviando, guardando en cola: ${result.error}")
                if (pendingQueue.size < MAX_PENDING) pendingQueue.add(payload)
            }
        }
    }

    /**
     * Notificación persistente que indica que el servicio está activo.
     * Esto es requerido por Android para servicios de larga duración.
     */
    private fun showPersistentNotification() {
        val intent = Intent(this, MainActivity::class.java)
        val pi     = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)

        val notif = NotificationCompat.Builder(this, GastosApp.CHANNEL_STATUS)
            .setSmallIcon(R.drawable.ic_money)
            .setContentTitle("Control de Gastos activo")
            .setContentText("Monitoreando Bancolombia y Nequi")
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(1, notif)
    }
}
