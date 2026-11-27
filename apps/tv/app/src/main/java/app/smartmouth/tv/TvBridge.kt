package app.smartmouth.tv

import android.app.UiModeManager
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.webkit.JavascriptInterface

/** Exposed to the page as `window.SmartmouthTV`. */
class TvBridge(ctx: Context) {
    private val tv: Boolean =
        ctx.getSystemService(UiModeManager::class.java)?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION ||
            ctx.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)

    /** True on an Android TV / Google TV device, false on a phone or tablet (e.g. the emulator). */
    @JavascriptInterface
    fun isTv(): Boolean = tv

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    companion object {
        const val NAME = "SmartmouthTV"
    }
}
