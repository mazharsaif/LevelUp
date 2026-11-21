package de.com.levelup.core

import de.com.levelup.core.sync.ApiClient
import de.com.levelup.core.sync.MemoryKeyValue
import de.com.levelup.core.sync.Net
import de.com.levelup.core.sync.PutResult
import de.com.levelup.core.sync.SyncEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * Talks to the LOCAL test server only (never the live site):
 *   cd server_fastapi && A1_DATA=<tmpdir> LU_MASTER_PASSWORD=admin uv run main.py 8899
 *   LU_TEST_SERVER=http://127.0.0.1:8899 ./gradlew :core:test
 * Skipped when LU_TEST_SERVER is not set. Uses the default test learners (taha / batul) with the master password.
 */
class SyncIntegrationTest {
    private val base = System.getenv("LU_TEST_SERVER").orEmpty()
    private fun engine(kv: MemoryKeyValue = MemoryKeyValue(), course: String = "de-a1"): SyncEngine {
        val cd = Golden.course(course)
        return SyncEngine(ApiClient(base, kv), kv, Store(cd)).also { it.selectCourse(course) }
    }

    @Test fun loginLoadSaveAndConflict() {
        assumeTrue("set LU_TEST_SERVER to run", base.startsWith("http://127.0.0.1") || base.startsWith("http://localhost"))
        val kvA = MemoryKeyValue(); val a = engine(kvA)
        assertEquals("on", a.checkAuth())
        // wrong password, then the master password
        assertTrue(a.login("taha", "nope") is Net.Err)
        val r = a.login("taha", "admin"); assertTrue("login: $r", r is Net.Ok)
        assertTrue("session cookie kept", a.api.cookies.hasSession())
        assertEquals("on", a.checkAuth()); assertEquals("taha", a.user)
        a.loadUsers()
        // load (server copy may be null on a fresh data dir), make a change, save
        val S = a.switchUser("taha")
        S["nativeTestField"] = jobj("kept" to true)          // an unknown field must survive the round trip
        a.store.settings()["setupByNative"] = "yes"
        S["setup"] = true
        a.store.addXP(3.0)
        val p1 = a.push(); assertEquals(PutResult.Saved, p1); assertFalse(a.pending)
        // a second device (fresh cookie jar + cache) sees the same file, unknown fields intact
        val kvB = MemoryKeyValue(); val b = engine(kvB)
        assertTrue(b.login("taha", "admin") is Net.Ok); b.checkAuth(); b.loadUsers()
        val SB = b.switchUser("taha")
        assertEquals(true, SB.obj("nativeTestField")["kept"])
        assertEquals("yes", b.store.settings()["setupByNative"])
        // B saves later; A's copy is now stale -> 409 and A takes B's copy
        b.store.addXP(5.0); assertEquals(PutResult.Saved, b.push())
        a.store.S!!["updated"] = 1.0                       // A's write is older than the server's copy
        var replaced = false; a.onStateReplaced = { replaced = true }
        val p2 = a.api.putState("taha", "de-a1", a.store.S!!)
        assertTrue("stale write rejected: $p2", p2 is PutResult.Conflict)
        a.store.S!!["updated"] = 1.0
        a.push()
        assertTrue("A took the newer copy", replaced)
        assertEquals(b.store.totalXP(), a.store.totalXP(), 1e-9)
        // another learner's progress is off limits
        val other = a.api.putState("batul", "de-a1", a.store.S!!)
        assertEquals(PutResult.AuthLost, other)
        // per-course files: French progress is separate
        val fr = engine(kvA, "fr-a1"); fr.checkAuth(); fr.loadUsers()
        val SF = fr.switchUser("taha")
        assertFalse(SF.containsKey("nativeTestField"))
        // logout ends the session
        a.logout()
        assertFalse(a.api.cookies.hasSession())
        assertTrue(a.api.getState("taha", "de-a1") is Net.Err)
    }
}
