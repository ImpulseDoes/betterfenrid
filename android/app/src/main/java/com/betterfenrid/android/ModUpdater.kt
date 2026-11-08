package com.betterfenrid.android

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class ModUpdater(context: Context) {

    class Mod(val code: String, val version: String)

    class Result(val status: String, val version: String? = null, val error: String? = null) {

        fun toJson(): JSONObject = JSONObject().apply {
            put("status", status)
            version?.let { put("version", it) }
            error?.let { put("error", it) }
        }
    }

    private val assets = context.assets
    private val cacheFile = File(context.filesDir, "betterfenrid.js")
    private val executor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    @Volatile
    var loaded: Mod? = null
        private set
    @Volatile
    var pending: Mod? = null
        private set

    var lastCheck = 0L
        private set

    fun load(): Mod? {

        val best = listOfNotNull(readCache(), readBundled()).maxWithOrNull { a, b -> compareVersions(a.version, b.version) }

        loaded = best
        pending = null

        return best
    }

    fun check(onNew: (Mod) -> Unit = {}, onDone: (Result) -> Unit = {}) {

        lastCheck = System.currentTimeMillis()

        executor.execute {

            val result = try {

                val latest = latestVersion()
                val have = pending?.version ?: loaded?.version ?: "0"

                if (compareVersions(latest, have) <= 0) {

                    Result(if (pending != null) "ready" else "latest", have)

                } else {

                    val mod = download()

                    pending = mod
                    main.post { onNew(mod) }

                    Result("ready", mod.version)
                }

            } catch (err: Exception) {

                Log.w(TAG, "Update check failed", err)
                Result("error", error = err.message ?: err.javaClass.simpleName)
            }

            main.post { onDone(result) }
        }
    }

    fun close() = executor.shutdownNow()

    private fun readCache(): Mod? = runCatching { modOf(cacheFile.readText()) }.getOrNull()

    private fun readBundled(): Mod? = runCatching { modOf(assets.open(ASSET).bufferedReader().use { it.readText() }) }.getOrNull()

    private fun latestVersion(): String {

        val connection = open(LATEST).apply {
            requestMethod = "HEAD"
            instanceFollowRedirects = false
        }

        try {

            val location = connection.getHeaderField("Location").orEmpty()

            return Regex("""/releases/download/v?([\d.]+)/""").find(location)?.groupValues?.get(1)
                ?: error("Unexpected answer from GitHub (${connection.responseCode})")

        } finally {

            connection.disconnect()
        }
    }

    private fun download(): Mod {

        val connection = open(LATEST)

        try {

            if (connection.responseCode != 200) error("Download failed (${connection.responseCode})")

            val code = connection.inputStream.bufferedReader().use { it.readText() }
            val mod = modOf(code) ?: error("The download is not a Better Fenrid build")

            val temp = File(cacheFile.path + ".tmp")

            temp.writeText(code)

            if (!temp.renameTo(cacheFile)) error("Could not save the update")

            return mod

        } finally {

            connection.disconnect()
        }
    }

    private fun open(url: String) = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = TIMEOUT_MS
        readTimeout = TIMEOUT_MS
    }

    companion object {

        const val ASSET = "betterfenrid.js"
        const val CHECK_EVERY_MS = 2 * 60 * 60_000L

        private const val TAG = "BetterFenrid"
        private const val LATEST = "https://github.com/ImpulseDoes/betterfenrid/releases/latest/download/betterfenrid.js"
        private const val TIMEOUT_MS = 30_000

        private val VERSION = Regex("""\bvar VERSION = "([\d.]+)"""")

        fun versionOf(code: String): String = VERSION.find(code)?.groupValues?.get(1) ?: "0"

        fun modOf(code: String): Mod? {

            val version = versionOf(code)

            return if (code.length > 10_000 && code.contains("window.BetterFenrid") && version != "0") Mod(code, version) else null
        }

        fun compareVersions(a: String, b: String): Int {

            val left = a.split('.').map { it.toIntOrNull() ?: 0 }
            val right = b.split('.').map { it.toIntOrNull() ?: 0 }

            for (i in 0 until maxOf(left.size, right.size)) {

                val diff = left.getOrElse(i) { 0 } - right.getOrElse(i) { 0 }

                if (diff != 0) return Integer.signum(diff)
            }

            return 0
        }
    }
}