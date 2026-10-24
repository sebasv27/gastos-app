// src/main/java/com/gastosapp/GastosApp.kt
package com.gastosapp

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class GastosApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_STATUS,
                "Estado del servicio",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Indica que el monitoreo de gastos está activo"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_STATUS = "gastos_status"
        const val PREFS_NAME     = "gastos_prefs"
        const val KEY_TOKEN      = "device_token"
        const val KEY_SERVER_URL = "server_url"

        // Paquetes bancarios que se monitorean
        val BANK_PACKAGES = setOf(
            "com.bancolombia.decomposition",   // Bancolombia App
            "com.nequi.mobileapp",             // Nequi
            "com.davivienda.daviplataapp",      // Daviplata
            "com.bbva.nativemobileapp",        // BBVA
            "com.davivienda.movil",            // Davivienda
        )
    }
}
