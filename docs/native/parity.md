# Native app parity

Since 11-21 the native app shows the web app itself in a WebView, so every screen, icon, pop-up, theme and
feature is the web's own. Only these differ:

| Feature | Native app | Notes |
|---|---|---|
| All screens, lessons, themes, rank emblem, sheets | Same as web | Same HTML/CSS/JS from levelrise.org |
| Login, sync, offline after first start | Same as web | Cookies kept by the WebView; service worker caches |
| Invite (share) | Works | Android share sheet via the bridge |
| Backup export | Works | Android save dialog via the bridge |
| Backup import | Works | Android file picker |
| APK / PDF downloads, other sites | Open in the browser | |
| 🎤 Speak it | Works (untested on a phone) | Android SpeechRecognizer behind the same Web Speech API; mic permission on first tap |
| Text-to-speech fallback | May be silent | Only for clips without an mp3 |
| Home-screen widgets | To do | Designs in docs/design/widgets/ |
| Reminders, alarms | To do | |
| Tested on a real phone | Not yet | Builds and logic tests only (no emulator here) |
