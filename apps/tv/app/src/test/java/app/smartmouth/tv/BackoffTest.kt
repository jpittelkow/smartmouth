package app.smartmouth.tv

import org.junit.Assert.assertEquals
import org.junit.Test

class BackoffTest {
    @Test fun startsAtTwoSeconds() = assertEquals(2_000L, Backoff.delayMs(0))

    @Test fun doubles() {
        assertEquals(4_000L, Backoff.delayMs(1))
        assertEquals(8_000L, Backoff.delayMs(2))
        assertEquals(32_000L, Backoff.delayMs(4))
    }

    @Test fun capsAtAMinute() {
        assertEquals(60_000L, Backoff.delayMs(5))
        assertEquals(60_000L, Backoff.delayMs(1_000))
    }

    @Test fun negativeIsFirst() = assertEquals(2_000L, Backoff.delayMs(-3))
}
