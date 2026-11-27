package app.smartmouth.tv

/**
 * How long to wait before the next reconnect attempt when the server cannot be reached:
 * 2 s, 4 s, 8 s ... doubling up to a minute. Attempt 0 is the first retry after a failure.
 * Reset to 0 once a page loads.
 */
object Backoff {
    const val FIRST_MS = 2_000L
    const val LONGEST_MS = 60_000L

    fun delayMs(attempt: Int): Long {
        if (attempt <= 0) return FIRST_MS
        return minOf(LONGEST_MS, FIRST_MS shl minOf(attempt, 20))
    }
}
