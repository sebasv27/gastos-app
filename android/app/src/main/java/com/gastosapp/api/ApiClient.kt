// src/main/java/com/gastosapp/api/ApiClient.kt
package com.gastosapp.api

import android.util.Log
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit

data class NotificationPayload(
    val appPackage: String,
    val title: String,
    val text: String,
    val timestamp: Long
)

data class ApiResult(
    val success: Boolean,
    val ignored: Boolean = false,
    val error: String? = null
)

class ApiClient {

    private val gson = Gson()
    private val json = "application/json; charset=utf-8".toMediaType()

    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        })
        .build()

    /**
     * Envía una notificación bancaria al backend para que la procese.
     */
    suspend fun sendNotification(
        serverUrl: String,
        token: String,
        payload: NotificationPayload
    ): ApiResult = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(payload).toRequestBody(json)
            val request = Request.Builder()
                .url("$serverUrl/api/webhooks/notification")
                .addHeader("X-Device-Token", token)
                .post(body)
                .build()

            val response = http.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            return@withContext when {
                response.isSuccessful -> {
                    val isIgnored = responseBody.contains("\"ignored\":true")
                    ApiResult(success = true, ignored = isIgnored)
                }
                response.code == 401 -> ApiResult(success = false, error = "Token inválido — inicia sesión de nuevo")
                else -> ApiResult(success = false, error = "Error ${response.code}")
            }
        } catch (e: Exception) {
            Log.e("ApiClient", "Error enviando notificación: ${e.message}")
            ApiResult(success = false, error = e.message)
        }
    }

    /**
     * Envía lote de notificaciones pendientes (cuando vuelve la conexión).
     */
    suspend fun sendBatch(
        serverUrl: String,
        token: String,
        notifications: List<NotificationPayload>
    ): ApiResult = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("notifications" to notifications)).toRequestBody(json)
            val request = Request.Builder()
                .url("$serverUrl/api/webhooks/batch")
                .addHeader("X-Device-Token", token)
                .post(body)
                .build()

            val response = http.newCall(request).execute()
            ApiResult(success = response.isSuccessful)
        } catch (e: Exception) {
            ApiResult(success = false, error = e.message)
        }
    }

    /**
     * Verifica que el servidor y el token son válidos.
     */
    suspend fun checkStatus(serverUrl: String, token: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/webhooks/status")
                    .addHeader("X-Device-Token", token)
                    .get()
                    .build()
                http.newCall(request).execute().isSuccessful
            } catch (e: Exception) {
                false
            }
        }

    /**
     * Login para obtener el token JWT.
     */
    suspend fun login(serverUrl: String, email: String, password: String): String? =
        withContext(Dispatchers.IO) {
            try {
                val body = gson.toJson(mapOf("email" to email, "password" to password))
                    .toRequestBody(json)
                val request = Request.Builder()
                    .url("$serverUrl/api/auth/login")
                    .post(body)
                    .build()
                val response = http.newCall(request).execute()
                if (!response.isSuccessful) return@withContext null
                val resp = gson.fromJson(response.body?.string(), Map::class.java)
                resp["token"] as? String
            } catch (e: Exception) {
                null
            }
        }
}
