package app.smartmouth.tv

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/**
 * Sets the Smartmouth server address.
 *
 * From ADB, without touching the remote:
 *
 *     adb shell am start -n app.smartmouth.tv/.ConfigActivity --es server_url http://192.168.1.4:8470
 *
 * saves the address and opens the game. Without the extra (e.g. from the error screen) it shows
 * a one-field form. The manifest requires android.permission.DUMP of outside callers, which
 * ADB's shell has and ordinary apps cannot get.
 */
class ConfigActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val given = intent?.getStringExtra(EXTRA_URL)
        if (given != null) {
            if (Prefs.isValid(given)) {
                Prefs.setServerUrl(this, given)
                Log.i(TAG, "server set to ${Prefs.serverUrl(this)}")
                openGame()
            } else {
                Log.w(TAG, "refused server address: $given")
            }
            finish()
            return
        }
        setContentView(buildForm())
    }

    private fun buildForm(): LinearLayout {
        val name = getString(R.string.app_name)
        val pad = dp(48)
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(pad, pad, pad, pad)
            setBackgroundColor(Color.rgb(0x1B, 0x10, 0x35))
        }
        val title = TextView(this).apply {
            text = getString(R.string.config_title, name)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
            setTextColor(Color.WHITE)
        }
        val help = TextView(this).apply {
            text = getString(R.string.config_help, name)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.rgb(0xC9, 0xC2, 0xDB))
            setPadding(0, dp(12), 0, dp(24))
        }
        val field = EditText(this).apply {
            setText(Prefs.serverUrl(this@ConfigActivity))
            hint = getString(R.string.config_hint)
            setSingleLine()
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            imeOptions = EditorInfo.IME_ACTION_DONE
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
            setSelectAllOnFocus(true)
        }
        val save = {
            val url = field.text.toString()
            if (Prefs.isValid(url)) {
                Prefs.setServerUrl(this, url)
                openGame()
                finish()
            } else {
                Toast.makeText(this, R.string.config_invalid, Toast.LENGTH_SHORT).show()
            }
        }
        field.setOnEditorActionListener { _, action, _ ->
            if (action == EditorInfo.IME_ACTION_DONE) { save(); true } else false
        }
        val buttons = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, 0)
            addView(button(R.string.config_save) { save() })
            addView(button(R.string.config_reset) {
                Prefs.setServerUrl(this@ConfigActivity, null)
                field.setText(Prefs.serverUrl(this@ConfigActivity))
            })
            addView(button(R.string.config_cancel) { finish() })
        }
        form.addView(title)
        form.addView(help)
        form.addView(field, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        form.addView(buttons)
        field.requestFocus()
        return form
    }

    private fun button(label: Int, onClick: () -> Unit) = Button(this).apply {
        text = getString(label)
        setOnClickListener { onClick() }
    }

    private fun openGame() {
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        )
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_URL = "server_url"
        private const val TAG = "SmartmouthTV"
    }
}
