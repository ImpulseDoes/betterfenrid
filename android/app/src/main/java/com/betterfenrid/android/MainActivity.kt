package com.betterfenrid.android

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONException
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    private lateinit var root: FrameLayout
    private lateinit var webView: WebView
    private lateinit var updater: ModUpdater

    private val chrome = Chrome()
    private var script: ScriptHandler? = null
    private var fallbackScript: String? = null
    private var page: JavaScriptReplyProxy? = null

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var permissionRequest: PermissionRequest? = null
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->

        val callback = fileCallback ?: return@registerForActivityResult

        fileCallback = null
        callback.onReceiveValue(if (result.resultCode == RESULT_OK) urisOf(result.data) else null)
    }

    private val askForPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {

        val request = permissionRequest ?: return@registerForActivityResult

        permissionRequest = null
        grantWhatsAllowed(request)
    }

    private val updateTimer = object : Runnable {

        override fun run() {

            if (System.currentTimeMillis() - updater.lastCheck >= ModUpdater.CHECK_EVERY_MS) checkForUpdate()

            root.postDelayed(this, UPDATE_TIMER_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {

        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        root = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.background)) }

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->

            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())

            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        setContentView(root)

        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        updater = ModUpdater(this)
        webView = createWebView()
        root.addView(webView, MATCH_PARENT, MATCH_PARENT)

        injectMod(updater.load())

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {

            override fun handleOnBackPressed() {

                if (customView != null) return chrome.onHideCustomView()

                webView.evaluateJavascript(ASK_PAGE_BACK) { handled ->

                    if (handled == "true" || isDestroyed) return@evaluateJavascript

                    if (webView.canGoBack()) webView.goBack() else moveTaskToBack(true)
                }
            }
        })

        webView.loadUrl(fenridLink(intent?.data) ?: HOME)
    }

    override fun onNewIntent(intent: Intent) {

        super.onNewIntent(intent)

        fenridLink(intent.data)?.let { webView.loadUrl(it) }
    }

    override fun onStart() {

        super.onStart()

        webView.onResume()
    }

    override fun onStop() {

        webView.onPause()

        super.onStop()
    }

    override fun onResume() {

        super.onResume()

        root.postDelayed(updateTimer, FIRST_CHECK_MS)
    }

    override fun onPause() {

        super.onPause()

        root.removeCallbacks(updateTimer)
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {

        permissionRequest?.deny()
        fileCallback?.onReceiveValue(null)
        updater.close()
        root.removeAllViews()
        webView.destroy()

        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView() = WebView(this).apply {

        setBackgroundColor(getColor(R.color.background))

        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.setSupportMultipleWindows(false)
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

        webViewClient = Client()
        webChromeClient = chrome

        setDownloadListener { url, userAgent, disposition, mimeType, _ -> download(url, userAgent, disposition, mimeType) }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {

            WebViewCompat.addWebMessageListener(this, "BetterFenridAndroid", ORIGINS) { _, message, _, isMainFrame, reply ->

                if (isMainFrame) onBridgeMessage(message.data, reply)
            }
        }
    }

    private fun injectMod(mod: ModUpdater.Mod?) {

        val code = BRIDGE.replace("APP_VERSION", JSONObject.quote(BuildConfig.VERSION_NAME)) + "\n;\n" + (mod?.code ?: "")

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {

            script?.remove()
            script = WebViewCompat.addDocumentStartJavaScript(webView, code, ORIGINS)

        } else {

            fallbackScript = code
        }
    }

    private fun checkForUpdate(onDone: (ModUpdater.Result) -> Unit = {}) {

        updater.check(
            onNew = { mod ->

                if (isDestroyed) return@check

                // Picked up by the next page load
                injectMod(mod)
                tell(page, JSONObject().put("type", "ready").put("version", mod.version))
            },
            onDone = { result -> if (!isDestroyed) onDone(result) },
        )
    }

    private fun onBridgeMessage(data: String?, reply: JavaScriptReplyProxy) {

        val message = try {

            JSONObject(data ?: return)

        } catch (e: JSONException) {

            return
        }

        when (message.optString("type")) {

            "hello" -> page = reply

            "open" -> Uri.parse(message.optString("url")).takeIf { it.scheme == "https" || it.scheme == "http" }?.let(::openExternal)

            "check" -> {

                val id = message.optInt("id")

                checkForUpdate { result -> tell(reply, JSONObject().put("type", "reply").put("id", id).put("result", result.toJson())) }
            }
        }
    }

    private fun tell(target: JavaScriptReplyProxy?, message: JSONObject) {

        runCatching { target?.postMessage(message.toString()) }
    }

    private fun isFenrid(uri: Uri?) = uri?.scheme == "https" && uri.host == "fenrid.com"
    private fun fenridLink(uri: Uri?) = uri?.takeIf(::isFenrid)?.toString()
    private fun openExternal(uri: Uri) {

        if (uri.scheme !in EXTERNAL_SCHEMES) return

        try {

            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))

        } catch (e: ActivityNotFoundException) {

            toast("No app can open this link")
        }
    }

    private fun download(url: String, userAgent: String, disposition: String?, mimeType: String?) {

        val uri = Uri.parse(url)

        if (uri.scheme != "https") return toast("This file can't be downloaded in the app")

        val name = URLUtil.guessFileName(url, disposition, mimeType)
        val request = DownloadManager.Request(uri).apply {
            setMimeType(mimeType)
            addRequestHeader("User-Agent", userAgent)
            CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
            setTitle(name)
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
        }

        getSystemService(DownloadManager::class.java).enqueue(request)
        toast("Downloading $name")
    }

    private fun androidPermission(resource: String) = when (resource) {

        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
        
        else -> null
    }

    private fun hasPermission(permission: String) = checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun grantWhatsAllowed(request: PermissionRequest) {

        val allowed = request.resources.filter { resource -> androidPermission(resource)?.let(::hasPermission) == true }

        if (allowed.isEmpty()) request.deny() else request.grant(allowed.toTypedArray())
    }

    private fun urisOf(data: Intent?): Array<Uri>? {

        val clip = data?.clipData

        if (clip != null && clip.itemCount > 0) return Array(clip.itemCount) { clip.getItemAt(it).uri }

        return data?.data?.let { arrayOf(it) }
    }

    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_SHORT).show()

    private inner class Client : WebViewClient() {

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {

            val url = request.url

            if (!request.isForMainFrame || isFenrid(url) || url.toString() == "about:blank") return false

            openExternal(url)

            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {

            val code = fallbackScript ?: return

            if (isFenrid(url?.let(Uri::parse))) view.evaluateJavascript(code, null)
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {

            root.removeView(view)
            recreate()

            return true
        }
    }

    private inner class Chrome : WebChromeClient() {

        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {

            fileCallback?.onReceiveValue(null)
            fileCallback = callback

            val mimeTypes = params.acceptTypes.orEmpty()
                .flatMap { it.split(',') }
                .map { it.trim().lowercase() }
                .filter { '/' in it }
                .distinct()

            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = mimeTypes.singleOrNull() ?: "*/*"
                if (mimeTypes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
            }

            try {

                pickFiles.launch(intent)

            } catch (e: ActivityNotFoundException) {

                fileCallback = null
                callback.onReceiveValue(null)
            }

            return true
        }

        override fun onPermissionRequest(request: PermissionRequest) {

            if (!isFenrid(request.origin)) return request.deny()

            val missing = request.resources.mapNotNull(::androidPermission).filterNot(::hasPermission).distinct()

            if (missing.isEmpty()) return grantWhatsAllowed(request)

            permissionRequest?.deny()
            permissionRequest = request
            askForPermissions.launch(missing.toTypedArray())
        }

        override fun onPermissionRequestCanceled(request: PermissionRequest) {

            if (permissionRequest == request) permissionRequest = null
        }

        override fun onShowCustomView(view: View, callback: CustomViewCallback) {

            if (customView != null) return callback.onCustomViewHidden()

            customView = view
            customViewCallback = callback
            view.setBackgroundColor(Color.BLACK)
            root.addView(view, MATCH_PARENT, MATCH_PARENT)

            WindowCompat.getInsetsController(window, root).apply {
                systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                hide(WindowInsetsCompat.Type.systemBars())
            }
        }

        override fun onHideCustomView() {

            val view = customView ?: return

            root.removeView(view)
            customView = null
            customViewCallback?.onCustomViewHidden()
            customViewCallback = null

            WindowCompat.getInsetsController(window, root).show(WindowInsetsCompat.Type.systemBars())
        }

        override fun getDefaultVideoPoster(): Bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
    }

    companion object {

        private const val HOME = "https://fenrid.com/channels/me"
        private const val FIRST_CHECK_MS = 15_000L
        private const val UPDATE_TIMER_MS = 30 * 60_000L
        private val ORIGINS = setOf("https://fenrid.com")
        private val EXTERNAL_SCHEMES = setOf("https", "http", "mailto", "tel", "sms", "geo")
        private const val ASK_PAGE_BACK = "(() => { try { return window.BetterFenridNative?.handleBack?.() === true } catch { return false } })()"

        private val BRIDGE = """
            (() => {

              const port = window.BetterFenridAndroid
              
              if (!port || window.BetterFenridNative) return

              const waiting = new Map()
              const readyListeners = new Set()
              const backListeners = []

              let nextId = 0

              const send = (message) => port.postMessage(JSON.stringify(message))

              port.addEventListener('message', (event) => {

                let message
                
                try { message = JSON.parse(event.data) } catch { return }
                
                if (message.type === 'reply') {
                
                  waiting.get(message.id)?.(message.result)
                  waiting.delete(message.id)
                
                }
                
                if (message.type === 'ready') for (const listener of readyListeners) listener({ version: message.version })
              
              })

              Object.defineProperty(window, 'BetterFenridNative', {
                value: Object.freeze({
                  version: APP_VERSION,
                  platform: 'android',
                  media: { subscribe: () => () => {}, command() {} },
                  openExternal: (url) => send({ type: 'open', url: String(url) }),
                  updates: {
                    check: () => new Promise((resolve) => {
                      const id = ++nextId
                      waiting.set(id, resolve)
                      send({ type: 'check', id })
                    }),
                    onReady(listener) {

                      if (typeof listener !== 'function') throw new TypeError('listener must be a function')
                     
                      readyListeners.add(listener)
                     
                      return () => readyListeners.delete(listener)
                    },
                  },

                  onBack(listener) {

                    if (typeof listener !== 'function') throw new TypeError('listener must be a function')

                    backListeners.push(listener)

                    return () => {
                      const i = backListeners.indexOf(listener)
                      if (i >= 0) backListeners.splice(i, 1)
                    }
                  },
                  handleBack() {

                    for (const listener of [...backListeners].reverse()) {
                      try { if (listener() === true) return true } catch (err) { console.error(err) }
                    }

                    return false
                  },
                }),
              })

              send({ type: 'hello' })
            })()
        """.trimIndent()
    }
}