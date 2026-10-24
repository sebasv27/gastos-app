// src/main/java/com/gastosapp/service/BootReceiver.kt
package com.gastosapp.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Se activa cuando el teléfono arranca.
 * Android re-conecta NotificationListenerService automáticamente si está habilitado
 * en Ajustes, pero este receiver asegura que cualquier lógica de inicio también corra.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.i("BootReceiver", "Dispositivo reiniciado — servicio de notificaciones activo")
            // NotificationListenerService se reconecta automáticamente por Android
            // si el usuario lo tiene habilitado en Ajustes > Notificaciones > Acceso
        }
    }
}
