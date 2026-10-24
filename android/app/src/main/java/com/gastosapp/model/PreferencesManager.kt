// src/main/java/com/gastosapp/model/PreferencesManager.kt
package com.gastosapp.model

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.gastosapp.GastosApp
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = GastosApp.PREFS_NAME)

class PreferencesManager(private val context: Context) {

    private val TOKEN_KEY      = stringPreferencesKey(GastosApp.KEY_TOKEN)
    private val SERVER_URL_KEY = stringPreferencesKey(GastosApp.KEY_SERVER_URL)

    val token: Flow<String?> = context.dataStore.data.map { it[TOKEN_KEY] }
    val serverUrl: Flow<String?> = context.dataStore.data.map { it[SERVER_URL_KEY] }

    suspend fun saveToken(token: String) {
        context.dataStore.edit { it[TOKEN_KEY] = token }
    }

    suspend fun saveServerUrl(url: String) {
        context.dataStore.edit { it[SERVER_URL_KEY] = url.trimEnd('/') }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
