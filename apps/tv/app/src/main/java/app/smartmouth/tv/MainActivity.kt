package app.smartmouth.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/**
 * The whole app: a full-screen web view showing `<server>/host?tv=1`. When the server cannot be
 * reached it shows a native retry screen and reconnects with exponential backoff; the page is
 * never left on a browser error page.
 */
class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var root: FrameLayout
    private lateinit var errorView: View
    private lateinit var errorTitle: TextView
    private lateinit var errorDetail: TextView
    private lateinit var retryButton: Button

    private var web: WebView? = null
    /** The page the web view was last pointed at (changes when ConfigActivity saves a new server). */
    private var target: String? = null
    private var failed = false
    private var loadFailed = false
    private var attempt = 0
    private var retryAt = 0L
    private var lastBack = 0L

    private val retry = Runnable { load() }
    private val countdown = object : Runnable {
        override fun run() {
            if (!failed) return
            showCountdown()
            handler.postDelayed(this, 1_000)
        }
    }
    // A server that does not answer at all (wrong IP, host asleep) can leave a load hanging for
    // a long time before WebView gives up. Treat a load that has not finished by then as failed.
    // onPageFinished cancels it.
    private val loadTimeout = Runnable { fail("timed out") }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG) // chrome://inspect on debug builds

        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        errorView = buildErrorView()
        root.addView(errorView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)
        immersive()
        newWebView()
        load()
    }

    override fun onResume() {
        super.onResume()
        immersive()
        web?.onResume()
        if (target != Prefs.hostUrl(this)) { attempt = 0; load() } // the server address was changed
    }

    override fun onPause() {
        web?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        web?.let { root.removeView(it); it.destroy() }
        web = null
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) immersive()
    }

    // ---- keys -------------------------------------------------------------------------------

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        when (event.keyCode) {
            KeyEvent.KEYCODE_BACK -> {
                if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) onBack()
                return true
            }
            KeyEvent.KEYCODE_MENU -> if (failed) {
                // Held Menu on the error screen opens the server settings.
                if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 1) openConfig()
                return true
            }
        }
        // Everything else (D-pad, OK/Enter, media keys) goes to the focused view: the page.
        return super.dispatchKeyEvent(event)
    }

    /** The page gets the first say: `window.smartmouthBack()` returning true means it handled Back. */
    private fun onBack() {
        val view = web
        if (failed || view == null) { confirmQuit(); return }
        view.evaluateJavascript(
            "(function(){try{return !!(window.smartmouthBack&&window.smartmouthBack());}catch(e){return false;}})()",
        ) { result -> if (result != "true") confirmQuit() }
    }

    private fun confirmQuit() {
        val now = SystemClock.uptimeMillis()
        if (now - lastBack < 2_000) { finish(); return }
        lastBack = now
        Toast.makeText(this, getString(R.string.back_again, getString(R.string.app_name)), Toast.LENGTH_SHORT).show()
    }

    // ---- page -------------------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun newWebView() {
        web?.let { root.removeView(it); it.destroy() }
        val view = WebView(this)
        view.settings.javaScriptEnabled = true
        view.settings.domStorageEnabled = true
        // The host voice has to start on its own; nobody presses anything on the TV first.
        view.settings.mediaPlaybackRequiresUserGesture = false
        view.setBackgroundColor(Color.BLACK)
        view.isVerticalScrollBarEnabled = false
        view.isHorizontalScrollBarEnabled = false
        view.isFocusable = true
        view.isFocusableInTouchMode = true
        view.visibility = View.INVISIBLE
        view.addJavascriptInterface(TvBridge(this), TvBridge.NAME)

        view.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                Log.d(TAG, "page: ${m.message()} (${m.sourceId()}:${m.lineNumber()})")
                return true
            }

            // Without this, a <video> with no poster shows WebView's grey play-button placeholder.
            override fun getDefaultVideoPoster(): Bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
        }

        view.webViewClient = object : WebViewClient() {
            // Only the configured server may occupy the frame; links and redirects elsewhere are refused.
            override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                val home = Uri.parse(Prefs.serverUrl(this@MainActivity))
                val to = request.url
                return !(to.scheme == home.scheme && to.host == home.host && to.port == home.port)
            }

            override fun onReceivedError(v: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) fail("${error.errorCode} ${error.description}")
            }

            override fun onReceivedHttpError(v: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame && response.statusCode >= 400) fail("HTTP ${response.statusCode}")
            }

            override fun onPageFinished(v: WebView, url: String) {
                if (v !== web || loadFailed || url.startsWith("about:")) return
                handler.removeCallbacks(loadTimeout)
                attempt = 0
                hideError()
                v.visibility = View.VISIBLE
                v.requestFocus()
            }

            // Android may reclaim the page's renderer when memory is short. Returning true keeps
            // the app alive; build a fresh web view and load again.
            override fun onRenderProcessGone(v: WebView, detail: RenderProcessGoneDetail): Boolean {
                Log.w(TAG, "page renderer gone (crashed=${detail.didCrash()})")
                if (v === web) handler.post { newWebView(); load() }
                return true
            }
        }
        root.addView(view, 0, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        web = view
    }

    private fun load() {
        val view = web ?: return
        handler.removeCallbacks(retry)
        handler.removeCallbacks(loadTimeout)
        val url = Prefs.hostUrl(this)
        target = url
        loadFailed = false
        if (failed) errorDetail.text = getString(R.string.error_retrying, Prefs.serverUrl(this))
        handler.removeCallbacks(countdown)
        view.loadUrl(url)
        handler.postDelayed(loadTimeout, LOAD_TIMEOUT_MS)
    }

    private fun fail(why: String) {
        if (loadFailed) return
        Log.w(TAG, "could not load ${target}: $why")
        loadFailed = true
        failed = true
        handler.removeCallbacks(loadTimeout)
        web?.let { it.stopLoading(); it.visibility = View.INVISIBLE; it.loadUrl("about:blank") }
        val wait = Backoff.delayMs(attempt)
        attempt++
        retryAt = SystemClock.uptimeMillis() + wait
        handler.postDelayed(retry, wait)
        showError()
    }

    private fun retryNow() {
        attempt = 0
        load()
    }

    private fun openConfig() {
        startActivity(Intent(this, ConfigActivity::class.java))
    }

    // ---- error screen -----------------------------------------------------------------------

    private fun showError() {
        if (errorView.visibility != View.VISIBLE) {
            errorView.visibility = View.VISIBLE
            retryButton.requestFocus()
        }
        handler.removeCallbacks(countdown)
        countdown.run()
    }

    private fun hideError() {
        failed = false
        handler.removeCallbacks(countdown)
        errorView.visibility = View.GONE
    }

    private fun showCountdown() {
        val secs = ((retryAt - SystemClock.uptimeMillis() + 999) / 1_000).coerceAtLeast(0)
        errorDetail.text = getString(R.string.error_detail, Prefs.serverUrl(this), secs, attempt)
    }

    private fun buildErrorView(): View {
        val name = getString(R.string.app_name)
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.rgb(0x1B, 0x10, 0x35))
            visibility = View.GONE
            val pad = dp(48)
            setPadding(pad, pad, pad, pad)
        }
        errorTitle = text(getString(R.string.error_title, name), 30f, Color.WHITE)
        errorDetail = text("", 18f, Color.rgb(0xC9, 0xC2, 0xDB)).apply { setPadding(0, dp(16), 0, dp(32)) }
        retryButton = Button(this).apply {
            text = getString(R.string.error_retry)
            setOnClickListener { retryNow() }
            // Holding OK on the remote is a long-click on the focused button.
            setOnLongClickListener { openConfig(); true }
        }
        val settings = Button(this).apply {
            text = getString(R.string.error_settings)
            setOnClickListener { openConfig() }
        }
        val buttons = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            addView(retryButton)
            addView(settings, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(16) })
        }
        val hint = text(getString(R.string.error_hint), 14f, Color.rgb(0x8A, 0x80, 0xA8)).apply { setPadding(0, dp(24), 0, 0) }
        box.addView(errorTitle)
        box.addView(errorDetail)
        box.addView(buttons)
        box.addView(hint)
        return box
    }

    private fun text(s: String, sp: Float, color: Int) = TextView(this).apply {
        text = s
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        setTextColor(color)
        gravity = Gravity.CENTER
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    // ---- window -----------------------------------------------------------------------------

    @Suppress("DEPRECATION")
    private fun immersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_FULLSCREEN
                )
        }
    }

    companion object {
        private const val TAG = "SmartmouthTV"
        private const val LOAD_TIMEOUT_MS = 20_000L
    }
}
