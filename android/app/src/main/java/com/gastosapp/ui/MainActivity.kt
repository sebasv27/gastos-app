// src/main/java/com/gastosapp/ui/MainActivity.kt
package com.gastosapp.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.gastosapp.R
import com.gastosapp.api.ApiClient
import com.gastosapp.databinding.ActivityMainBinding
import com.gastosapp.model.PreferencesManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: PreferencesManager
    private val api = ApiClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = PreferencesManager(applicationContext)

        setupUI()
        checkCurrentStatus()
    }

    override fun onResume() {
        super.onResume()
        checkCurrentStatus()
    }

    private fun setupUI() {
        // Botón: abrir ajustes de acceso a notificaciones
        binding.btnPermission.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        // Botón: guardar configuración y probar conexión
        binding.btnSave.setOnClickListener {
            val serverUrl = binding.etServerUrl.text.toString().trim()
            val email     = binding.etEmail.text.toString().trim()
            val password  = binding.etPassword.text.toString()

            if (serverUrl.isEmpty() || email.isEmpty() || password.isEmpty()) {
                toast("Completa todos los campos")
                return@setOnClickListener
            }

            lifecycleScope.launch {
                binding.btnSave.isEnabled = false
                binding.progressBar.visibility = View.VISIBLE

                val token = api.login(serverUrl, email, password)
                if (token == null) {
                    toast("Error: email o contraseña incorrectos")
                    binding.btnSave.isEnabled = true
                    binding.progressBar.visibility = View.GONE
                    return@launch
                }

                prefs.saveServerUrl(serverUrl)
                prefs.saveToken(token)

                val ok = api.checkStatus(serverUrl, token)
                binding.progressBar.visibility = View.GONE
                binding.btnSave.isEnabled = true

                if (ok) {
                    toast("✅ Conectado correctamente")
                    checkCurrentStatus()
                } else {
                    toast("Error de conexión con el servidor")
                }
            }
        }

        // Botón: desconectar
        binding.btnDisconnect.setOnClickListener {
            lifecycleScope.launch {
                prefs.clear()
                checkCurrentStatus()
                toast("Desconectado")
            }
        }
    }

    private fun checkCurrentStatus() {
        lifecycleScope.launch {
            val token     = prefs.token.first()
            val serverUrl = prefs.serverUrl.first()
            val hasPermission = isNotificationPermissionGranted()
            val isConnected   = !token.isNullOrBlank() && !serverUrl.isNullOrBlank()

            // Panel de estado
            binding.statusConnected.visibility = if (isConnected) View.VISIBLE else View.GONE
            binding.statusDisconnected.visibility = if (!isConnected) View.VISIBLE else View.GONE

            // Sección de permisos
            binding.permissionOk.visibility   = if (hasPermission) View.VISIBLE else View.GONE
            binding.permissionNeeded.visibility= if (!hasPermission) View.VISIBLE else View.GONE

            if (isConnected) {
                binding.tvServerUrlActive.text = serverUrl
                binding.setupSection.visibility = View.GONE
            } else {
                binding.setupSection.visibility = View.VISIBLE
            }
        }
    }

    private fun isNotificationPermissionGranted(): Boolean {
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: ""
        return flat.contains(packageName)
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
