package app.smartmouth.tv

import android.content.Context
import android.net.Uri

/** The server address, set per device through ConfigActivity. */
object Prefs {
    private const val FILE = "smartmouth"
    private const val KEY_URL = "server_url"

    fun serverUrl(ctx: Context): String =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_URL, null) ?: BuildConfig.DEFAULT_SERVER_URL

    /** Saves [url], or goes back to the build default when it is null. */
    fun setServerUrl(ctx: Context, url: String?) {
        val edit = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
        if (url == null) edit.remove(KEY_URL) else edit.putString(KEY_URL, normalize(url))
        edit.apply()
    }

    /** The page the TV shows. */
    fun hostUrl(ctx: Context): String = serverUrl(ctx) + "/host?tv=1"

    fun normalize(url: String): String = url.trim().trimEnd('/')

    /** An http(s) address with a host and no user:password part. */
    fun isValid(url: String): Boolean {
        val uri = try { Uri.parse(normalize(url)) } catch (e: Exception) { return false }
        return (uri.scheme == "http" || uri.scheme == "https") && !uri.host.isNullOrEmpty() && uri.userInfo == null
    }
}
